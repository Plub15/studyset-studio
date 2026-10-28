import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { parseCards, buildGoodnotes, inspectGoodnotes } from "../converter.js";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

test("parses plain Unicode CSV, BOM, mixed line endings, and surrounding spaces", () => {
  assert.deepEqual(parseCards("\uFEFF1,하나\r\n\n 2 , 둘 \r3,셋\n"), [["1", "하나"], ["2", "둘"], ["3", "셋"]]);
});

test("handles quoted commas, escaped quotes, emoji, and multiline CRLF fields", () => {
  assert.deepEqual(parseCards('"What, exactly?","He said ""hello"" 🐱"\r\n"Line 1\r\nLine 2",คำตอบ'), [
    ["What, exactly?", 'He said "hello" 🐱'], ["Line 1\r\nLine 2", "คำตอบ"],
  ]);
});

test("reverse cards immediately follow their source rows without deduplication", () => {
  assert.deepEqual(parseCards("1,하나\n하나,1", { reverse: true }), [["1", "하나"], ["하나", "1"], ["하나", "1"], ["1", "하나"]]);
});

test("treats the first row as a card, with no automatic header removal", () => {
  assert.deepEqual(parseCards("Question,Answer\nQ,A"), [["Question", "Answer"], ["Q", "A"]]);
});

test("trims surrounding whitespace, including outside quoted fields", () => {
  assert.deepEqual(parseCards(' \t "a" \t, "b" \n\u0085q\u001F,\u3000a\u3000'), [["a", "b"], ["q", "a"]]);
  assert.deepEqual(parseCards('"a  b\nc", d  e'), [["a  b\nc", "d  e"]]);
  assert.deepEqual(parseCards("x,\uFEFFanswer"), [["x", "\uFEFFanswer"]]);
});

for (const source of ["", "\uFEFF", "\r\n\n  \r\t\n", '""\n']) {
  test(`rejects empty input ${JSON.stringify(source)}`, () => {
    assert.throws(() => parseCards(source), /No cards found/);
  });
}

for (const [source, expected] of [
  ["one", /Line 1: expected exactly 2 fields.*found 1/],
  ["q,a,extra", /Line 1: expected exactly 2 fields.*found 3/],
  ["q,a\nq,b,c", /Line 2: expected exactly 2 fields/],
  ["q,", /Line 1: question and answer must both be nonempty/],
  [",a", /Line 1: question and answer must both be nonempty/],
  ['q,"   "', /Line 1: question and answer must both be nonempty/],
  ['"bad quote,a', /Invalid CSV near line 1: unexpected end of data/],
  ['"bad\nquote,a\n', /Invalid CSV near line 2: unexpected end of data/],
  ['"q" x,a', /Invalid CSV near line 1: ',' expected after '"'/],
  ['a"x,b', /Invalid CSV near line 1: put a field containing quotation marks/],
  ['"q" "x",a', /Invalid CSV near line 1/],
  ['"line\nline",a,b', /Line 2: expected exactly 2 fields/],
]) {
  test(`gives line-specific error for ${JSON.stringify(source)}`, () => assert.throws(() => parseCards(source), expected));
}

test("generates a valid four-card archive with the original event shape", () => {
  const cards = parseCards("1,하나\n2,둘", { reverse: true });
  const archive = buildGoodnotes(cards, "한국어 숫자");
  assert.ok(archive instanceof Uint8Array);
  assert.deepEqual(Array.from(archive.subarray(0, 4)), [0x50, 0x4B, 0x03, 0x04]);
  const inspected = inspectGoodnotes(archive);
  assert.deepEqual(inspected.cards, cards);
  assert.equal(inspected.title, "한국어 숫자");
  assert.equal(inspected.eventCount, 20);
  assert.equal(inspected.deletedCardCount, 1);
  assert.deepEqual(inspected.ranks, ["4B7Ql", "AvdJ0", "FQA0u", "Kb~kU"]);
  assert.deepEqual(inspected.entryNames, ["document.info.pb", "index.search.pb", "index.notes.pb", "index.events.pb", "index.attachments.pb", "schema.pb"]);
  assert.deepEqual(inspected.replicaIds, ["6465619701922282114"]);
  assert.ok(BigInt(inspected.replicaIds[0]) > BigInt(Number.MAX_SAFE_INTEGER));
});

for (const count of [1, 2, 5, 6, 70, 1000]) {
  test(`preserves ${count} cards and their order across rank carries`, () => {
    const cards = Array.from({ length: count }, (_, index) => [`질문 ${index + 1} 🐱`, `คำตอบ ${index + 1} 漢字`]);
    const inspected = inspectGoodnotes(buildGoodnotes(cards, `${count} cards`));
    assert.deepEqual(inspected.cards, cards);
    assert.equal(inspected.cardIds.length, count);
    assert.equal(new Set(inspected.cardIds).size, count);
    assert.equal(new Set(inspected.ranks).size, count);
    assert.deepEqual(inspected.ranks, [...inspected.ranks].sort());
    assert.equal(inspected.deletedCardCount, 1);
  });
}

test("rebuilds length prefixes for long UTF-8 text and retains inner BOM", () => {
  const cards = [["질문".repeat(400), 'Answer, with "quotes"\r\n' + "漢".repeat(700)], ["x", "\uFEFFanswer"]];
  assert.deepEqual(inspectGoodnotes(buildGoodnotes(cards, "한".repeat(200))).cards, cards);
});

test("each conversion gets new document and card identities", () => {
  const first = inspectGoodnotes(buildGoodnotes([["q", "a"]], "Set"));
  const second = inspectGoodnotes(buildGoodnotes([["q", "a"]], "Set"));
  assert.notEqual(first.documentId, second.documentId);
  assert.notEqual(first.cardIds[0], second.cardIds[0]);
});

test("supports the crypto.getRandomValues fallback used by older Safari", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }, configurable: true });
  try {
    const inspected = inspectGoodnotes(buildGoodnotes([["q", "a"]], "Fallback"));
    assert.match(inspected.documentId, /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
  } finally {
    if (original) Object.defineProperty(globalThis, "crypto", original);
    else delete globalThis.crypto;
  }
});

test("detects corrupt ZIP contents", () => {
  const bytes = buildGoodnotes([["q", "a"]], "Set");
  const broken = bytes.slice();
  broken[46] ^= 0x10; // document.info.pb data begins at offset 46.
  assert.throws(() => inspectGoodnotes(broken), /integrity check/);
  assert.throws(() => inspectGoodnotes(bytes.subarray(0, bytes.length - 1)), /Incomplete ZIP/);
});

test("rejects invalid API card/title values", () => {
  assert.throws(() => buildGoodnotes([], "Set"), /No cards found/);
  assert.throws(() => buildGoodnotes([["q", "a"]], " \t"), /title cannot be blank/);
  assert.throws(() => buildGoodnotes([["q", ""]], "Set"), /Card 1/);
  assert.throws(() => buildGoodnotes([["q", "a", "b"]], "Set"), /Card 1/);
  assert.throws(() => parseCards(null), /must be text/);
});
