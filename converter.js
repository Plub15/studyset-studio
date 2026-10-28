/**
 * Plain-text Goodnotes Study Set converter. No runtime dependencies or network.
 *
 * Port of goodnotes_from_txt.py 1.0.0, based on the schema-24 Study Set whose
 * four-card variant the user successfully imported into Goodnotes. It keeps
 * the same create/update/deletion histories and inferred lexical card ranks.
 * This is a template-based writer, not an official Goodnotes SDK.
 *
 * Public-source template sanitization:
 * - Every document, card, event, folder, and editor UUID was replaced through
 *   a consistent bijection with a fresh dummy UUID.
 * - The replica/device uint64 is a newly generated, fixed nonpersonal value.
 * - Revision nonces were replaced consistently with new random uint32s.
 * - The title and nonempty text leaves contain generic sample text only.
 * - Template timestamps/counters use a fixed generic epoch.
 * Field numbers/types, revision counters, ranks, and event histories remain
 * unchanged. Conversion replaces document/card/event IDs and timestamps anew.
 */

const TEMPLATE_EVENTS_B64 =
  "yQIKJDMwRDBCMUNDLUYwMjctNDkyRi1CMjY1LTUxRDcwQkQzODZDN/IBnwIKJDMwRDBCMUNDLUYwMjctNDkyRi1CMjY1LTUxRDcw" +
  "QkQzODZDNxIeChJTdHVkeSBTZXQgVGVtcGxhdGUSCAgBEMmKtr4LGjAKJDgzM0Q3RTBGLTdCQ0MtNDQwNS1BQzE3LTM0NTBCMUFB" +
  "Q0UxQRIICAEQm/vf3AgyDQoBUBIICAEQwN21rQw6MAokQUQyNTEzMUMtQ0M1MC00OEQ0LTkyNzQtNUJGMEU1QjM3MzJDEggIARC0" +
  "hNqQAkIGcHVycGxlSgRhdXRvUQAAQB8lzHhCWiQyMjRGRDI5RC1DOEVELTQ5QkQtOTA1NS0xRjU5MTQwMjk5MzVogvXgjs3bn91Z" +
  "cIDox5LMMXgBigEAkgEAmgEKEggIARCdgLTcA6ABGPUBCiRGRUEyQzVDNS1FMUNELTRFNDgtODk0NC0zMjZCM0JBNTdEQjm6CcsB" +
  "CiRGRUEyQzVDNS1FMUNELTRFNDgtODk0NC0zMjZCM0JBNTdEQjkSJDMwRDBCMUNDLUYwMjctNDkyRi1CMjY1LTUxRDcwQkQzODZD" +
  "NyIRCgU0QjdRbBIICAEQp7Lu0wgqEgoOCgwKCnRleHQvcGxhaW4SADISCg4KDAoKdGV4dC9wbGFpbhIAOgBRABBAHyXMeEJaJDZC" +
  "RjExOTYwLTYyQUItNEI1Qi05NTk0LUY0QTY3RkYxODE4OGiC9eCOzduf3VlwgejHkswxeBiHAgokRkVBMkM1QzUtRTFDRC00RTQ4" +
  "LTg5NDQtMzI2QjNCQTU3REI5wgndAQokRkVBMkM1QzUtRTFDRC00RTQ4LTg5NDQtMzI2QjNCQTU3REI5EiQzMEQwQjFDQy1GMDI3" +
  "LTQ5MkYtQjI2NS01MUQ3MEJEMzg2QzcaEQoFNEI3UWwSCAgBEKey7tMIIiQKGAoWCgp0ZXh0L3BsYWluEghRdWVzdGlvbhIICAEQ" +
  "rMDW6wwqEgoOCgwKCnRleHQvcGxhaW4SADIAUQAgQB8lzHhCWiRCREUzNkNBRS1DMDY1LTQ1MzUtODAwOC0yRDQyOUNCMjVFMzdo" +
  "gvXgjs3bn91ZcILox5LMMXgYlwIKJEZFQTJDNUM1LUUxQ0QtNEU0OC04OTQ0LTMyNkIzQkE1N0RCOcIJ7QEKJEZFQTJDNUM1LUUx" +
  "Q0QtNEU0OC04OTQ0LTMyNkIzQkE1N0RCORIkMzBEMEIxQ0MtRjAyNy00OTJGLUIyNjUtNTFENzBCRDM4NkM3GhEKBTRCN1FsEggI" +
  "ARCnsu7TCCIkChgKFgoKdGV4dC9wbGFpbhIIUXVlc3Rpb24SCAgBEKzA1usMKiIKFgoUCgp0ZXh0L3BsYWluEgZBbnN3ZXISCAgB" +
  "ELKywtYNMgBRADBAHyXMeEJaJDgzMkQwNDM4LTI1NTAtNDcwOS04MDc2LUIwRDYzQUY1ODEyQmiC9eCOzduf3Vlwg+jHkswxeBj1" +
  "AQokRTQ3N0ZCREUtMjI0OS00MjZELUIzNDQtQzRCODkyRDgwOTdEugnLAQokRTQ3N0ZCREUtMjI0OS00MjZELUIzNDQtQzRCODky" +
  "RDgwOTdEEiQzMEQwQjFDQy1GMDI3LTQ5MkYtQjI2NS01MUQ3MEJEMzg2QzciEQoFQXZkSjASCAgBENrG94UKKhIKDgoMCgp0ZXh0" +
  "L3BsYWluEgAyEgoOCgwKCnRleHQvcGxhaW4SADoAUQBAQB8lzHhCWiRBNEYwOUQ5Qy02RTgwLTQyMkItQkZDMS05QkNBQzEwNUY3" +
  "ODhogvXgjs3bn91ZcITox5LMMXgYhQIKJEU0NzdGQkRFLTIyNDktNDI2RC1CMzQ0LUM0Qjg5MkQ4MDk3RMIJ2wEKJEU0NzdGQkRF" +
  "LTIyNDktNDI2RC1CMzQ0LUM0Qjg5MkQ4MDk3RBIkMzBEMEIxQ0MtRjAyNy00OTJGLUIyNjUtNTFENzBCRDM4NkM3GhEKBUF2ZEow" +
  "EggIARDaxveFCiIaCg4KDAoKdGV4dC9wbGFpbhIICAEQ68eU5AIqGgoOCgwKCnRleHQvcGxhaW4SCAgBEO7pp/ILMgBRAFBAHyXM" +
  "eEJaJDlFMzM2OEExLTBEOEQtNDc4Ri1CNTRELUYwRDlGRDU4NTY0QmiC9eCOzduf3VlwhejHkswxeBiOAgokRTQ3N0ZCREUtMjI0" +
  "OS00MjZELUIzNDQtQzRCODkyRDgwOTdEwgnkAQokRTQ3N0ZCREUtMjI0OS00MjZELUIzNDQtQzRCODkyRDgwOTdEEiQzMEQwQjFD" +
  "Qy1GMDI3LTQ5MkYtQjI2NS01MUQ3MEJEMzg2QzcaEQoFQXZkSjASCAgBENrG94UKIiMKGAoWCgp0ZXh0L3BsYWluEghRdWVzdGlv" +
  "bhIHCAIQ98nRJyoaCg4KDAoKdGV4dC9wbGFpbhIICAEQ7umn8gsyAFEAYEAfJcx4QlokQjJCN0RDRTktODQ0My00NzFCLUEyMEMt" +
  "OEQwMTE2MkI0REFDaIL14I7N25/dWXCG6MeSzDF4GJYCCiRFNDc3RkJERS0yMjQ5LTQyNkQtQjM0NC1DNEI4OTJEODA5N0TCCewB" +
  "CiRFNDc3RkJERS0yMjQ5LTQyNkQtQjM0NC1DNEI4OTJEODA5N0QSJDMwRDBCMUNDLUYwMjctNDkyRi1CMjY1LTUxRDcwQkQzODZD" +
  "NxoRCgVBdmRKMBIICAEQ2sb3hQoiIwoYChYKCnRleHQvcGxhaW4SCFF1ZXN0aW9uEgcIAhD3ydEnKiIKFgoUCgp0ZXh0L3BsYWlu" +
  "EgZBbnN3ZXISCAgCEIbso54CMgBRAHBAHyXMeEJaJEYwM0Y3ODYwLUFGNUUtNDAyOC04MUEzLTMxNjFCQ0RBRkYzMGiC9eCOzduf" +
  "3Vlwh+jHkswxeBj1AQokQkYwRkFERjktQTAzNS00ODM2LTg3OUQtMjJCMjBCODhCMUE4ugnLAQokQkYwRkFERjktQTAzNS00ODM2" +
  "LTg3OUQtMjJCMjBCODhCMUE4EiQzMEQwQjFDQy1GMDI3LTQ5MkYtQjI2NS01MUQ3MEJEMzg2QzciEQoFRlFBMHUSCAgBELboxfUH" +
  "KhIKDgoMCgp0ZXh0L3BsYWluEgAyEgoOCgwKCnRleHQvcGxhaW4SADoAUQCAQB8lzHhCWiQyNEM5MDQxOS05QjYwLTRFQjgtODYx" +
  "Qi1DMDJBQkRFRkVCNzVogvXgjs3bn91ZcIjox5LMMXgYhQIKJEJGMEZBREY5LUEwMzUtNDgzNi04NzlELTIyQjIwQjg4QjFBOMIJ" +
  "2wEKJEJGMEZBREY5LUEwMzUtNDgzNi04NzlELTIyQjIwQjg4QjFBOBIkMzBEMEIxQ0MtRjAyNy00OTJGLUIyNjUtNTFENzBCRDM4" +
  "NkM3GhEKBUZRQTB1EggIARC26MX1ByIaCg4KDAoKdGV4dC9wbGFpbhIICAEQ8dfcnQgqGgoOCgwKCnRleHQvcGxhaW4SCAgBENXy" +
  "5bUKMgBRAJBAHyXMeEJaJEQ4RkRDQjEwLThGQzgtNEE2Qy05MDYzLUE4RDRGNjNCNjIyQWiC9eCOzduf3VlwiejHkswxeBiPAgok" +
  "QkYwRkFERjktQTAzNS00ODM2LTg3OUQtMjJCMjBCODhCMUE4wgnlAQokQkYwRkFERjktQTAzNS00ODM2LTg3OUQtMjJCMjBCODhC" +
  "MUE4EiQzMEQwQjFDQy1GMDI3LTQ5MkYtQjI2NS01MUQ3MEJEMzg2QzcaEQoFRlFBMHUSCAgBELboxfUHIiQKGAoWCgp0ZXh0L3Bs" +
  "YWluEghRdWVzdGlvbhIICAIQyamY3g4qGgoOCgwKCnRleHQvcGxhaW4SCAgBENXy5bUKMgBRAKBAHyXMeEJaJEM3QURDRkQ5LTIx" +
  "NTktNDIxNC05NjQ2LUI2MzMyMzBBODM5RmiC9eCOzduf3VlwiujHkswxeBiXAgokQkYwRkFERjktQTAzNS00ODM2LTg3OUQtMjJC" +
  "MjBCODhCMUE4wgntAQokQkYwRkFERjktQTAzNS00ODM2LTg3OUQtMjJCMjBCODhCMUE4EiQzMEQwQjFDQy1GMDI3LTQ5MkYtQjI2" +
  "NS01MUQ3MEJEMzg2QzcaEQoFRlFBMHUSCAgBELboxfUHIiQKGAoWCgp0ZXh0L3BsYWluEghRdWVzdGlvbhIICAIQyamY3g4qIgoW" +
  "ChQKCnRleHQvcGxhaW4SBkFuc3dlchIICAIQxsPIqQcyAFEAsEAfJcx4QlokOUQ3NjI0RTMtQjg4OC00MkEzLUJGM0QtODhGQTFC" +
  "QTE2QjRBaIL14I7N25/dWXCL6MeSzDF4GPUBCiRDM0M2QUFDNS01RjRBLTQzQzgtOTQ4Ny05NEI1OTU5MzRENUO6CcsBCiRDM0M2" +
  "QUFDNS01RjRBLTQzQzgtOTQ4Ny05NEI1OTU5MzRENUMSJDMwRDBCMUNDLUYwMjctNDkyRi1CMjY1LTUxRDcwQkQzODZDNyIRCgVL" +
  "Yn5rVRIICAEQ2Z+W8gEqEgoOCgwKCnRleHQvcGxhaW4SADISCg4KDAoKdGV4dC9wbGFpbhIAOgBRAMBAHyXMeEJaJDc2QUM5MTJD" +
  "LUFBRDgtNDAyNS1BMUM5LUJFOEQwQkI1NjgzRWiC9eCOzduf3VlwjOjHkswxeBiFAgokQzNDNkFBQzUtNUY0QS00M0M4LTk0ODct" +
  "OTRCNTk1OTM0RDVDwgnbAQokQzNDNkFBQzUtNUY0QS00M0M4LTk0ODctOTRCNTk1OTM0RDVDEiQzMEQwQjFDQy1GMDI3LTQ5MkYt" +
  "QjI2NS01MUQ3MEJEMzg2QzcaEQoFS2J+a1USCAgBENmflvIBIhoKDgoMCgp0ZXh0L3BsYWluEggIARDBrpnJByoaCg4KDAoKdGV4" +
  "dC9wbGFpbhIICAEQ+sPS+gkyAFEA0EAfJcx4QlokNjUyNzNCMkUtQ0U0Qy00OTAxLUJFN0UtQjZBMjNEOUE4QzdGaIL14I7N25/d" +
  "WXCN6MeSzDF4GI8CCiRDM0M2QUFDNS01RjRBLTQzQzgtOTQ4Ny05NEI1OTU5MzRENUPCCeUBCiRDM0M2QUFDNS01RjRBLTQzQzgt" +
  "OTQ4Ny05NEI1OTU5MzRENUMSJDMwRDBCMUNDLUYwMjctNDkyRi1CMjY1LTUxRDcwQkQzODZDNxoRCgVLYn5rVRIICAEQ2Z+W8gEi" +
  "JAoYChYKCnRleHQvcGxhaW4SCFF1ZXN0aW9uEggIAhCtlMOlAioaCg4KDAoKdGV4dC9wbGFpbhIICAEQ+sPS+gkyAFEA4EAfJcx4" +
  "QlokOTVFOEMxREMtOUREOS00QUNFLTlFODAtNTc0RjVBM0E2MjhCaIL14I7N25/dWXCO6MeSzDF4GJcCCiRDM0M2QUFDNS01RjRB" +
  "LTQzQzgtOTQ4Ny05NEI1OTU5MzRENUPCCe0BCiRDM0M2QUFDNS01RjRBLTQzQzgtOTQ4Ny05NEI1OTU5MzRENUMSJDMwRDBCMUND" +
  "LUYwMjctNDkyRi1CMjY1LTUxRDcwQkQzODZDNxoRCgVLYn5rVRIICAEQ2Z+W8gEiJAoYChYKCnRleHQvcGxhaW4SCFF1ZXN0aW9u" +
  "EggIAhCtlMOlAioiChYKFAoKdGV4dC9wbGFpbhIGQW5zd2VyEggIAhDHta/5CzIAUQDwQB8lzHhCWiQxRDFCQUQ3RS1GNTJDLTQ1" +
  "MkYtQjg1OC0yMzNBRkQ1QzA5MjFogvXgjs3bn91ZcI/ox5LMMXgY9AEKJDkxNkYyRTFDLTg5NjUtNDFEMy05OTlFLUYzREVCMUU5" +
  "Rjg0MboJygEKJDkxNkYyRTFDLTg5NjUtNDFEMy05OTlFLUYzREVCMUU5Rjg0MRIkMzBEMEIxQ0MtRjAyNy00OTJGLUIyNjUtNTFE" +
  "NzBCRDM4NkM3IhAKBU8zflo1EgcIARCq1OZyKhIKDgoMCgp0ZXh0L3BsYWluEgAyEgoOCgwKCnRleHQvcGxhaW4SADoAUQAAQR8l" +
  "zHhCWiQ5MDgwRTNCNi00MzRELTQxQUEtQUFDMi02MzQ4REY5MjM0OENogvXgjs3bn91ZcJDox5LMMXgYgwIKJDkxNkYyRTFDLTg5" +
  "NjUtNDFEMy05OTlFLUYzREVCMUU5Rjg0McIJ2QEKJDkxNkYyRTFDLTg5NjUtNDFEMy05OTlFLUYzREVCMUU5Rjg0MRIkMzBEMEIx" +
  "Q0MtRjAyNy00OTJGLUIyNjUtNTFENzBCRDM4NkM3GhAKBU8zflo1EgcIARCq1OZyIhoKDgoMCgp0ZXh0L3BsYWluEggIARDI5IyD" +
  "BCoZCg4KDAoKdGV4dC9wbGFpbhIHCAEQvaP7XDIAUQAQQR8lzHhCWiQ2NjhCODM5Qy03QjNBLTQyMzYtOTQ5My01NTg5NUVBRkJD" +
  "NzNogvXgjs3bn91ZcJHox5LMMXgYxQEKJDkxNkYyRTFDLTg5NjUtNDFEMy05OTlFLUYzREVCMUU5Rjg0McoJmwEKJDkxNkYyRTFD" +
  "LTg5NjUtNDFEMy05OTlFLUYzREVCMUU5Rjg0MRIkMzBEMEIxQ0MtRjAyNy00OTJGLUIyNjUtNTFENzBCRDM4NkM3GgsIARIHCAEQ" +
  "6KTxVFEAIEEfJcx4QlokRDM2NEFDQjYtRkYwQy00MURCLUI1MzAtNEFDMTIyQTBENUQ3aIL14I7N25/dWXCS6MeSzDF4GO0BCiQz" +
  "MEQwQjFDQy1GMDI3LTQ5MkYtQjI2NS01MUQ3MEJEMzg2QzeyCcMBCiQzMEQwQjFDQy1GMDI3LTQ5MkYtQjI2NS01MUQ3MEJEMzg2" +
  "QzcSJEZFQTJDNUM1LUUxQ0QtNEU0OC04OTQ0LTMyNkIzQkE1N0RCORozRG9jdW1lbnRFZGl0b3I6ODA3RkFCQ0EtOTNCMS00MERF" +
  "LTg3RUUtMTM4OENGMTBEMDU4UQAwQR8lzHhCWiQxOTNFQURCMi1BREEyLTQ0NjctODgwOS0wQUFBRTU0RTFENTRogvXgjs3bn91Z" +
  "cJPox5LMMXgY";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const EVENT_TYPES = new Set([30, 150, 151, 152, 153]);
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MISSING = Symbol("missing");
const UINT64_LIMIT = 1n << 64n;
// Match Python str.strip(), including NEL and the ASCII information separators.
const PYTHON_WHITESPACE = /^[\u0009-\u000D\u001C-\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\u0009-\u000D\u001C-\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/g;
const strip = (value) => value.replace(PYTHON_WHITESPACE, "");

/**
 * Parse headerless question,answer CSV. Unlike Python's permissive unquoted
 * quote handling, quotes must surround a whole field. Whitespace outside a
 * quoted field is accepted and trimmed, as it is for unquoted fields.
 * UTF-8 BOM, CR/LF/CRLF, quoted commas, doubled quotes, multiline fields, and
 * surrounding whitespace are supported. Reverse cards immediately follow each row.
 * @param {string} text
 * @param {{reverse?: boolean}} [options]
 * @returns {Array<[string, string]>}
 */
export function parseCards(text, { reverse = false } = {}) {
  if (typeof text !== "string") throw new Error("The card input must be text.");
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  const cards = [];
  let row = [];
  let field = "";
  let state = "start"; // start | plain | quoted | afterQuote | afterQuoteSpace
  let line = 1;
  let touched = false;

  function finishRecord(recordLine) {
    row.push(field);
    if (!(row.length === 1 && !strip(row[0]))) {
      if (row.length !== 2) {
        throw new Error(`Line ${recordLine}: expected exactly 2 fields (question,answer), but found ${row.length}. Put a field containing commas inside double quotes.`);
      }
      const question = strip(row[0]);
      const answer = strip(row[1]);
      if (!question || !answer) {
        throw new Error(`Line ${recordLine}: question and answer must both be nonempty.`);
      }
      cards.push([question, answer]);
      if (reverse) cards.push([answer, question]);
    }
    row = [];
    field = "";
    state = "start";
    touched = false;
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const isNewline = char === "\r" || char === "\n";
    if (state === "quoted") {
      if (char === '"') {
        state = "afterQuote";
      } else {
        field += char;
        if (isNewline) {
          if (char === "\r" && text[i + 1] === "\n") field += text[++i];
          line += 1;
        }
      }
      continue;
    }
    if (isNewline) {
      finishRecord(line);
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      line += 1;
      continue;
    }
    touched = true;
    if (state === "afterQuote" || state === "afterQuoteSpace") {
      if (char === '"' && state === "afterQuote") {
        field += '"';
        state = "quoted";
      } else if (char === ",") {
        row.push(field);
        field = "";
        state = "start";
      } else if (!strip(char)) {
        state = "afterQuoteSpace";
      } else {
        throw new Error(`Invalid CSV near line ${line}: ',' expected after '"'.`);
      }
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      state = "start";
    } else if (state === "start" && !strip(char)) {
      // Ignore surrounding whitespace; whitespace inside content is retained.
    } else if (state === "start" && char === '"') {
      state = "quoted";
    } else if (char === '"') {
      throw new Error(`Invalid CSV near line ${line}: put a field containing quotation marks inside double quotes and escape each quote as "".`);
    } else {
      field += char;
      state = "plain";
    }
  }
  if (state === "quoted") {
    const eofLine = text.endsWith("\n") || text.endsWith("\r") ? Math.max(1, line - 1) : line;
    throw new Error(`Invalid CSV near line ${eofLine}: unexpected end of data.`);
  }
  if (touched || row.length || field) finishRecord(line);
  if (!cards.length) throw new Error("No cards found. Add at least one question,answer row.");
  return cards;
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  if (!Number.isSafeInteger(size)) throw new Error("The study set is too large.");
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function varint(value) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error("A protobuf integer lost precision.");
  }
  value = BigInt(value);
  if (value < 0n || value >= UINT64_LIMIT) throw new Error("Protobuf integer is outside the uint64 range.");
  const bytes = [];
  while (value > 127n) {
    bytes.push(Number(value & 127n) | 128);
    value >>= 7n;
  }
  bytes.push(Number(value));
  return new Uint8Array(bytes);
}

function readVarint(bytes, start = 0) {
  let value = 0n;
  let offset = start;
  for (let shift = 0n; shift < 70n; shift += 7n) {
    if (offset >= bytes.length) throw new Error("Truncated protobuf integer.");
    const byte = bytes[offset++];
    value |= BigInt(byte & 127) << shift;
    if (byte < 128) {
      if (value >= UINT64_LIMIT) throw new Error("Protobuf integer exceeds 64 bits.");
      return [value, offset];
    }
  }
  throw new Error("Invalid protobuf integer.");
}

function parse(bytes) {
  const fields = [];
  let offset = 0;
  while (offset < bytes.length) {
    let tag;
    [tag, offset] = readVarint(bytes, offset);
    const number = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (!number || number >= 2 ** 29) throw new Error("Invalid protobuf field number.");
    let value;
    if (wire === 0) {
      [value, offset] = readVarint(bytes, offset);
    } else if (wire === 1 || wire === 2 || wire === 5) {
      let length;
      if (wire === 2) {
        [length, offset] = readVarint(bytes, offset);
      } else {
        length = BigInt(wire === 1 ? 8 : 4);
      }
      if (length > BigInt(bytes.length - offset)) throw new Error("Truncated protobuf field.");
      const end = offset + Number(length);
      value = bytes.subarray(offset, end);
      offset = end;
    } else {
      throw new Error(`Unsupported protobuf wire type: ${wire}.`);
    }
    fields.push({ number, wire, value });
  }
  return fields;
}

function encode(fields) {
  const parts = [];
  for (const { number, wire, value } of fields) {
    parts.push(varint(BigInt(number) * 8n + BigInt(wire)));
    if (wire === 0) parts.push(varint(value));
    else if (wire === 2) parts.push(varint(value.length), value);
    else parts.push(value);
  }
  return concat(parts);
}

function get(bytes, path, fallback = MISSING) {
  for (const number of path) {
    const matches = parse(bytes).filter((field) => field.number === number);
    if (matches.length !== 1) {
      if (!matches.length && fallback !== MISSING) return fallback;
      throw new Error(`Expected one protobuf field ${number}.`);
    }
    bytes = matches[0].value;
  }
  return bytes;
}

function put(bytes, path, value) {
  const fields = parse(bytes);
  const matches = fields.filter((field) => field.number === path[0]);
  if (matches.length !== 1) throw new Error(`Cannot replace protobuf field ${path[0]}.`);
  const field = matches[0];
  field.value = path.length === 1 ? value : put(field.value, path.slice(1), value);
  return encode(fields);
}

function frames(bytes) {
  const messages = [];
  let offset = 0;
  while (offset < bytes.length) {
    let size;
    [size, offset] = readVarint(bytes, offset);
    if (size === 0n || size > BigInt(bytes.length - offset)) throw new Error("Invalid event frame length.");
    const end = offset + Number(size);
    const message = bytes.subarray(offset, end);
    parse(message);
    messages.push(message);
    offset = end;
  }
  return messages;
}

function event(message) {
  const matches = parse(message).filter((field) => EVENT_TYPES.has(field.number));
  if (matches.length !== 1) throw new Error("Unexpected Study Set event.");
  return [matches[0].number, matches[0].value];
}

function textLeaf(payload, field) {
  if (decoder.decode(get(payload, [field, 1, 1, 1])) !== "text/plain") {
    throw new Error("This writer supports plain-text cards only.");
  }
  return decoder.decode(get(payload, [field, 1, 1, 2], new Uint8Array()));
}

function uuidBytes() {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") return encoder.encode(crypto.randomUUID().toUpperCase());
  if (typeof crypto?.getRandomValues !== "function") {
    throw new Error("This browser cannot generate secure IDs. Open the site in an up-to-date browser.");
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return encoder.encode(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
}

let templateCache;
function loadTemplate() {
  if (templateCache) return templateCache;
  const raw = Uint8Array.from(atob(TEMPLATE_EVENTS_B64), (char) => char.charCodeAt(0));
  const blocks = new Map();
  let document;
  let selection;
  for (const message of frames(raw)) {
    const [kind, payload] = event(message);
    if (kind === 30) document = message;
    else if (kind === 150) selection = message;
    else {
      const id = decoder.decode(get(payload, [1]));
      if (!blocks.has(id)) blocks.set(id, []);
      blocks.get(id).push(message);
    }
  }
  const live = [];
  const deleted = [];
  for (const block of blocks.values()) {
    (block.some((message) => event(message)[0] === 153) ? deleted : live).push(block);
  }
  const blockKey = (block) => decoder.decode(get(event(block[0])[1], [4, 1]));
  live.sort((a, b) => blockKey(a) < blockKey(b) ? -1 : blockKey(a) > blockKey(b) ? 1 : 0);
  if (!document || !selection || live.length !== 4 || deleted.length !== 1) {
    throw new Error("The embedded Study Set structure is not recognized.");
  }
  const observedKeys = [...live, ...deleted].map(blockKey);
  if (new Set(observedKeys).size !== observedKeys.length || observedKeys.some((key, index) => index && key <= observedKeys[index - 1])) {
    throw new Error("Unexpected template card ordering.");
  }
  templateCache = { document, selection, live, deleted: deleted[0], observedKeys };
  return templateCache;
}

function rank(index, total, observedKeys) {
  if (index < observedKeys.length) return encoder.encode(observedKeys[index]);
  let width = 4;
  while (62 ** width <= total) width += 1;
  let number = index - observedKeys.length + 1;
  let digits = "";
  while (number) {
    digits = BASE62[number % 62] + digits;
    number = Math.floor(number / 62);
  }
  return encoder.encode(`P${digits.padStart(width, "0")}`);
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xFFFFFFFF;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xFFFFFFFF) >>> 0;
}

function zipStore(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  // Fixed generic DOS timestamp: 2024-01-01. Card event times are current.
  const dosDate = (2024 - 1980) << 9 | 1 << 5 | 1;
  for (const [name, bytes] of entries) {
    if (bytes.length >= 0xFFFFFFFF || offset >= 0xFFFFFFFF) throw new Error("The study set exceeds ZIP size limits.");
    const filename = encoder.encode(name);
    const checksum = crc32(bytes);
    const local = new Uint8Array(30 + filename.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034B50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(12, dosDate, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, filename.length, true);
    local.set(filename, 30);
    localParts.push(local, bytes);

    const central = new Uint8Array(46 + filename.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014B50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, bytes.length, true);
    cv.setUint32(24, bytes.length, true);
    cv.setUint16(28, filename.length, true);
    cv.setUint32(42, offset, true);
    central.set(filename, 46);
    centralParts.push(central);
    offset += local.length + bytes.length;
  }
  const directory = concat(centralParts);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054B50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directory.length, true);
  ev.setUint32(16, offset, true);
  return concat([...localParts, directory, end]);
}

function readStoredZip(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error("Expected a Uint8Array archive.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034B50) {
    if (offset + 30 > bytes.length) throw new Error("Truncated ZIP header.");
    if (view.getUint16(offset + 8, true) !== 0 || (view.getUint16(offset + 6, true) & 8)) {
      throw new Error("Inspection supports stored ZIP entries without data descriptors only.");
    }
    const checksum = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const rawSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + nameLength + extraLength;
    const end = dataStart + size;
    if (rawSize !== size || end > bytes.length) throw new Error("Invalid ZIP entry length.");
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const content = bytes.subarray(dataStart, end);
    if (entries.has(name) || crc32(content) !== checksum) throw new Error("Generated ZIP failed its integrity check.");
    entries.set(name, content);
    offset = end;
  }
  if (!entries.size || bytes.length < 22 || view.getUint32(bytes.length - 22, true) !== 0x06054B50) {
    throw new Error("Incomplete ZIP archive.");
  }
  const endOffset = bytes.length - 22;
  if (view.getUint32(endOffset + 16, true) !== offset || view.getUint16(endOffset + 10, true) !== entries.size || view.getUint32(endOffset + 12, true) + offset !== endOffset) {
    throw new Error("Inconsistent ZIP directory.");
  }
  return entries;
}

/** Inspect archives created by this module; not a general Goodnotes reader. */
export function inspectGoodnotes(bytes) {
  const entries = readStoredZip(bytes);
  const stream = entries.get("index.events.pb");
  if (!stream) throw new Error("The archive has no Study Set events.");
  const messages = frames(stream);
  const state = new Map();
  const deleted = new Set();
  const eventIds = new Set();
  const replicaIds = new Set();
  let documentId;
  let title;
  let selected;
  let lastCounter = -1n;
  for (const message of messages) {
    const [kind, payload] = event(message);
    const entity = decoder.decode(get(payload, [1]));
    if (decoder.decode(get(message, [1])) !== entity) throw new Error("Generated event has an inconsistent entity reference.");
    const eventId = decoder.decode(get(payload, [11]));
    const counter = get(payload, [14]);
    if (eventIds.has(eventId) || counter <= lastCounter) throw new Error("Generated event IDs or counters are inconsistent.");
    eventIds.add(eventId);
    replicaIds.add(get(payload, [13]).toString());
    lastCounter = counter;
    if (kind === 30) {
      if (documentId) throw new Error("Generated document metadata is inconsistent.");
      documentId = entity;
      title = decoder.decode(get(payload, [2, 1]));
    } else if (kind === 151 || kind === 152) {
      if (decoder.decode(get(payload, [2])) !== documentId) throw new Error("Generated card refers to the wrong document.");
      if (kind === 151 && state.has(entity)) throw new Error("Generated card ID is duplicated.");
      if (kind === 152 && !state.has(entity)) throw new Error("Generated update has no card creation event.");
      const [rankField, questionField, answerField] = kind === 151 ? [4, 5, 6] : [3, 4, 5];
      state.set(entity, { rank: decoder.decode(get(payload, [rankField, 1])), question: textLeaf(payload, questionField), answer: textLeaf(payload, answerField) });
    } else if (kind === 153) {
      if (!state.has(entity) || decoder.decode(get(payload, [2])) !== documentId || get(payload, [3, 1]) !== 1n) {
        throw new Error("Generated deletion event is inconsistent.");
      }
      deleted.add(entity);
    } else if (kind === 150) {
      if (entity !== documentId) throw new Error("Generated selection refers to the wrong document.");
      selected = decoder.decode(get(payload, [2]));
    }
  }
  const live = Array.from(state, ([id, card]) => ({ id, ...card })).filter((card) => !deleted.has(card.id));
  live.sort((a, b) => a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0);
  if (new Set(live.map((card) => card.rank)).size !== live.length) throw new Error("Generated card ranks are duplicated.");
  if (!state.has(selected) || deleted.has(selected)) throw new Error("Generated selection does not refer to a live card.");
  return { title, cards: live.map((card) => [card.question, card.answer]), ranks: live.map((card) => card.rank), cardIds: live.map((card) => card.id), documentId, eventCount: messages.length, deletedCardCount: deleted.size, replicaIds: Array.from(replicaIds), entryNames: Array.from(entries.keys()) };
}

/** Return a complete native .goodnotes ZIP archive for the supplied cards. */
export function buildGoodnotes(cards, title) {
  if (!Array.isArray(cards) || !cards.length) throw new Error("No cards found. Add at least one question,answer row.");
  if (typeof title !== "string" || !strip(title)) throw new Error("The study set title cannot be blank.");
  for (const [index, card] of cards.entries()) {
    if (!Array.isArray(card) || card.length !== 2 || !card.every((value) => typeof value === "string" && strip(value))) {
      throw new Error(`Card ${index + 1} needs a nonempty question and answer.`);
    }
  }
  const template = loadTemplate();
  const documentId = uuidBytes();
  const now = Date.now();
  const generated = [];
  let firstCardId;
  let serial = 0;

  function appendEvent(message, payload) {
    const [kind] = event(message);
    const timestamp = new Uint8Array(8);
    new DataView(timestamp.buffer).setFloat64(0, now + serial / 1000, true);
    payload = put(payload, [10], timestamp);
    payload = put(payload, [11], uuidBytes());
    payload = put(payload, [14], BigInt(now) + BigInt(serial));
    message = put(message, [1], get(payload, [1]));
    message = put(message, [kind], payload);
    generated.push(varint(message.length), message);
    serial += 1;
  }

  let payload = event(template.document)[1];
  payload = put(payload, [1], documentId);
  payload = put(payload, [2, 1], encoder.encode(title));
  appendEvent(template.document, payload);

  function appendCard(block, position, values) {
    const cardId = uuidBytes();
    for (const message of block) {
      let [kind, body] = event(message);
      body = put(body, [1], cardId);
      body = put(body, [2], documentId);
      if (kind === 151 || kind === 152) {
        const [rankField, questionField, answerField] = kind === 151 ? [4, 5, 6] : [3, 4, 5];
        body = put(body, [rankField, 1], position);
        if (values) {
          for (const [index, field] of [questionField, answerField].entries()) {
            if (textLeaf(body, field)) body = put(body, [field, 1, 1, 2], encoder.encode(values[index]));
          }
        }
      }
      appendEvent(message, body);
    }
    return cardId;
  }

  for (const [index, card] of cards.entries()) {
    const id = appendCard(template.live[index % template.live.length], rank(index, cards.length + 1, template.observedKeys), card);
    if (!firstCardId) firstCardId = id;
  }
  // Retain the Python writer's known deleted blank-card history. It is not
  // included in the active study-card count.
  const deletedIndex = Math.max(cards.length, template.observedKeys.length - 1);
  appendCard(template.deleted, rank(deletedIndex, cards.length + 1, template.observedKeys));
  payload = event(template.selection)[1];
  payload = put(payload, [1], documentId);
  payload = put(payload, [2], firstCardId);
  appendEvent(template.selection, payload);

  const bytes = zipStore([
    ["document.info.pb", new Uint8Array([8, 1])],
    ["index.search.pb", new Uint8Array()],
    ["index.notes.pb", new Uint8Array()],
    ["index.events.pb", concat(generated)],
    ["index.attachments.pb", new Uint8Array()],
    ["schema.pb", new Uint8Array([8, 24])],
  ]);
  const actual = inspectGoodnotes(bytes);
  if (actual.title !== title || actual.cards.length !== cards.length || actual.cards.some((card, index) => card[0] !== cards[index][0] || card[1] !== cards[index][1])) {
    throw new Error("Generated card contents or order did not match the input.");
  }
  return bytes;
}
