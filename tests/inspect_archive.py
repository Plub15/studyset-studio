"""Independent stdlib ZIP/protobuf reader. Does not import the JS/Python writer.

Usage: python tests/inspect_archive.py archive.goodnotes expected.json
Expected JSON is {"title": str, "cards": [[question, answer], ...]}.
"""
import json
import re
import struct
import sys
import zipfile


def integer(data, offset):
    value = 0
    for shift in range(0, 70, 7):
        assert offset < len(data), "Truncated varint"
        byte = data[offset]
        offset += 1
        value |= (byte & 127) << shift
        if byte < 128:
            assert value < 2**64, "Overflowed uint64"
            return value, offset
    raise AssertionError("Invalid varint")


def fields(data):
    offset = 0
    result = {}
    while offset < len(data):
        tag, offset = integer(data, offset)
        number, wire = tag >> 3, tag & 7
        assert number > 0 and number not in result, "Invalid/repeated field"
        if wire == 0:
            value, offset = integer(data, offset)
        else:
            assert wire in (1, 2, 5), "Invalid wire type"
            if wire == 2:
                length, offset = integer(data, offset)
            else:
                length = 8 if wire == 1 else 4
            assert offset + length <= len(data), "Truncated field"
            value = data[offset:offset + length]
            offset += length
        result[number] = value
    return result


def leaf(payload, number):
    content = fields(fields(fields(payload[number])[1])[1])
    assert content[1] == b'text/plain'
    return content.get(2, b'').decode('utf-8')


def inspect(path, expected):
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, "CRC failure"
        assert set(archive.namelist()) == {
            'document.info.pb', 'index.search.pb', 'index.notes.pb',
            'index.events.pb', 'index.attachments.pb', 'schema.pb',
        }, "Unexpected archive entries"
        assert archive.read('schema.pb') == b'\x08\x18'
        assert archive.read('document.info.pb') == b'\x08\x01'
        assert archive.read('index.attachments.pb') == b''
        stream = archive.read('index.events.pb')
    offset = 0
    state, deleted, ids, counters, kinds = {}, set(), set(), [], []
    document, selected, title = None, None, None
    while offset < len(stream):
        size, offset = integer(stream, offset)
        assert size > 0 and offset + size <= len(stream), "Invalid frame"
        event = fields(stream[offset:offset + size])
        offset += size
        event_kinds = set(event).intersection({30, 150, 151, 152, 153})
        assert len(event_kinds) == 1
        kind = event_kinds.pop()
        kinds.append(kind)
        payload = fields(event[kind])
        entity = payload[1]
        assert entity == event[1], "Entity mismatch"
        assert re.fullmatch(rb'[A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12}', entity)
        assert payload[11] not in ids, "Duplicate event ID"
        ids.add(payload[11])
        assert payload[13] == 6465619701922282114, "Lost uint64 precision"
        assert not counters or payload[14] > counters[-1], "Counter out of order"
        counters.append(payload[14])
        assert struct.unpack('<d', payload[10])[0] > 0
        if kind == 30:
            assert document is None
            document = entity
            title = fields(payload[2])[1].decode('utf-8')
        elif kind in (151, 152):
            assert payload[2] == document
            assert (entity not in state) if kind == 151 else (entity in state)
            rank_field, q_field, a_field = (4, 5, 6) if kind == 151 else (3, 4, 5)
            rank = fields(payload[rank_field])[1]
            state[entity] = (rank, leaf(payload, q_field), leaf(payload, a_field))
        elif kind == 153:
            assert payload[2] == document and entity in state
            assert fields(payload[3])[1] == 1
            deleted.add(entity)
        elif kind == 150:
            assert entity == document
            selected = payload[2]
    live = sorted(row for key, row in state.items() if key not in deleted)
    assert selected in state and selected not in deleted
    assert len(deleted) == 1
    assert len(set(row[0] for row in live)) == len(live)
    assert title == expected['title'], "Title mismatch"
    assert [[row[1], row[2]] for row in live] == expected['cards'], "Card content/order mismatch"
    assert len(ids) == len(kinds)
    print(f"Independent ZIP/CRC + protobuf verification passed: {len(live)} cards, {len(kinds)} events.")


if __name__ == '__main__':
    with open(sys.argv[2], encoding='utf-8') as handle:
        inspect(sys.argv[1], json.load(handle))
