export const MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const MAX_OUTPUT_CARDS = 5000;
export const MAX_FIELD_LENGTH = 20000;
export const EXAMPLE = '1,하나\n하나,1\n2,둘\n둘,2\n"Hello, friend",สวัสดี 👋';

export function validateSize(text) {
  if (text.length > MAX_INPUT_BYTES || new TextEncoder().encode(text).length > MAX_INPUT_BYTES) {
    throw new Error('Input exceeds 2 MiB. Split your text into smaller study sets.');
  }
}

export function validateCards(cards) {
  if (cards.length > MAX_OUTPUT_CARDS) {
    throw new Error('This set exceeds 5,000 output cards. Split it into smaller sets or turn off both directions.');
  }
  const oversized = cards.findIndex(pair => pair.some(text => text.length > MAX_FIELD_LENGTH));
  if (oversized !== -1) throw new Error(`Card ${oversized + 1}: each side can contain at most 20,000 characters. Shorten this card.`);
}

export function downloadName(title) {
  let name = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-').replace(/[. ]+$/g, '');
  name = name.replace(/\.goodnotes$/i, '');
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `Study set${name ? ` - ${name}` : ''}`;
  // Leave room for the extension on filesystems with a 255-byte filename limit.
  let safe = '';
  const encoder = new TextEncoder();
  for (const character of name) {
    if (encoder.encode(safe + character).length > 180) break;
    safe += character;
  }
  // WebKitGTK replaces spaces during download. Use one explicit filename on
  // every platform while preserving the title (and Unicode) inside the set.
  return `${(safe.replace(/[. ]+$/g, '') || 'Study set').replace(/\s+/gu, '_')}.goodnotes`;
}

export function decodeFile(buffer) {
  if (buffer.byteLength > MAX_INPUT_BYTES) throw new Error('File exceeds 2 MiB. Choose a smaller CSV or TXT file.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('This file is not valid UTF-8. Save it as UTF-8 CSV or TXT, then choose it again.');
  }
}
