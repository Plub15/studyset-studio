import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFile, downloadName, validateSize, validateCards, MAX_INPUT_BYTES } from '../app-utils.js';

test('filenames preserve Unicode, remove path/control characters, avoid reserved names, and fit filesystem limits', () => {
  assert.equal(downloadName('한국어 ภาษาไทย 🐱'), '한국어_ภาษาไทย_🐱.goodnotes');
  assert.equal(downloadName('../bad:name?\u0000'), '..-bad-name--.goodnotes');
  assert.equal(downloadName('CON'), 'Study_set_-_CON.goodnotes');
  assert.equal(downloadName('...'), 'Study_set.goodnotes');
  assert.equal(downloadName('Set.goodnotes'), 'Set.goodnotes');
  assert.ok(new TextEncoder().encode(downloadName('한🐱'.repeat(100))).length < 255);
  assert.ok(!downloadName('🐱'.repeat(100)).includes('\ufffd'));
});
test('file decoding accepts UTF-8 BOM and rejects invalid UTF-8', () => {
  assert.equal(decodeFile(new TextEncoder().encode('\uFEFF하나,หนึ่ง')), '하나,หนึ่ง');
  assert.throws(() => decodeFile(new Uint8Array([0xff, 0xfe, 0x41])), /not valid UTF-8/);
});
test('limits count encoded bytes and output cards', () => {
  assert.throws(() => validateSize('한'.repeat(MAX_INPUT_BYTES / 2)), /2 MiB/);
  assert.throws(() => decodeFile(new Uint8Array(MAX_INPUT_BYTES + 1)), /2 MiB/);
  assert.throws(() => validateCards(Array.from({ length: 5001 }, () => ['q', 'a'])), /5,000 output cards/);
  assert.throws(() => validateCards([['q'.repeat(20001), 'a']]), /Card 1/);
});
