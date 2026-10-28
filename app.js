import { EXAMPLE, MAX_INPUT_BYTES, downloadName, decodeFile } from './app-utils.js';

const byId = id => document.getElementById(id);
const ui = Object.fromEntries([
  'source-text', 'source-status', 'error-message', 'input-count', 'card-count',
  'deck-title', 'title-error', 'reverse-cards', 'preview-card', 'preview-side',
  'preview-text', 'preview-position', 'previous-card', 'next-card', 'download-button',
  'download-label', 'share-button', 'export-status', 'download-help', 'file-input',
  'choose-file', 'drop-zone', 'load-example', 'clear-input', 'help-dialog', 'help-open', 'help-close',
  'cancel-build', 'retry-conversion',
].map(id => [id, byId(id)]));
const text = ui['source-text'];
let cards = [];
let index = 0;
let answer = false;
let revision = 0;
let timer;
let watchdog;
let worker;
let working = false;
let building = false;
let readyFile;
let objectUrl;
let sharing = false;

function status(message) { ui['export-status'].textContent = message; }
function releaseFile() {
  readyFile = undefined;
  // A short grace period lets an in-progress browser download read the Blob.
  if (objectUrl) {
    const previousUrl = objectUrl;
    setTimeout(() => URL.revokeObjectURL(previousUrl), 60000);
  }
  objectUrl = undefined;
  ui['share-button'].hidden = true;
  ui['download-help'].hidden = true;
}
function renderPreview() {
  const card = cards[index];
  ui['preview-card'].disabled = !card;
  ui['preview-card'].dataset.side = answer ? 'answer' : 'question';
  ui['preview-card'].setAttribute('aria-label', card ? `Card ${index + 1}, ${answer ? 'answer' : 'question'}: ${card[answer ? 1 : 0]}. Flip to ${answer ? 'question' : 'answer'}.` : 'Card preview is empty');
  ui['preview-side'].textContent = answer ? 'ANSWER' : 'QUESTION';
  ui['preview-text'].textContent = card ? card[answer ? 1 : 0] : 'Your first card\nwill appear here.';
  ui['preview-position'].textContent = `${card ? index + 1 : 0} of ${cards.length}`;
  ui['previous-card'].disabled = !card || index === 0;
  ui['next-card'].disabled = !card || index === cards.length - 1;
}
function titleValid() {
  const valid = Boolean(ui['deck-title'].value.trim());
  ui['deck-title'].setAttribute('aria-invalid', String(!valid));
  ui['title-error'].hidden = valid;
  return valid;
}
function renderExport() {
  ui['download-button'].disabled = !cards.length || working || !titleValid();
  ui['download-label'].textContent = building ? 'Creating your file…' : readyFile ? 'Download study set' : 'Create study set';
  ui['download-button'].classList.toggle('is-busy', building);
  ui['cancel-build'].hidden = !building;
  ui['share-button'].disabled = sharing;
}
function finishWork() {
  clearTimeout(watchdog);
  working = false;
  building = false;
  ui['drop-zone'].removeAttribute('aria-busy');
  renderExport();
}
function stopWorker() {
  worker?.terminate();
  worker = undefined;
  clearTimeout(watchdog);
}
function inputError(message) {
  cards = [];
  ui['input-count'].textContent = '0';
  ui['card-count'].textContent = '0';
  ui['error-message'].textContent = message;
  ui['error-message'].hidden = false;
  text.setAttribute('aria-invalid', 'true');
  ui['source-status'].textContent = 'Check the input below.';
  finishWork();
  renderPreview();
}
function workerFailed() {
  stopWorker();
  inputError('Conversion could not finish. Try again, or split your input into a smaller set.');
  ui['retry-conversion'].hidden = false;
  status('Your input is still here. No file was created.');
}
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./conversion-worker.js', import.meta.url), { type: 'module' });
  worker.onerror = event => { event.preventDefault(); workerFailed(); };
  worker.onmessageerror = workerFailed;
  worker.onmessage = ({ data }) => {
    if (data.id !== revision) return;
    finishWork();
    if (data.type === 'error') {
      if (data.operation === 'parse') inputError(data.message);
      else status(`Could not create the file: ${data.message} Try creating it again.`);
      return;
    }
    if (data.type === 'parsed') {
      cards = data.cards;
      ui['input-count'].textContent = data.pairs.toLocaleString('en-US');
      ui['card-count'].textContent = cards.length.toLocaleString('en-US');
      ui['source-status'].textContent = `${data.pairs.toLocaleString('en-US')} input pairs · ${cards.length.toLocaleString('en-US')} output cards. Ready to preview.`;
      renderPreview();
      renderExport();
    } else if (data.type === 'built') {
      try {
        readyFile = new File([data.bytes], downloadName(ui['deck-title'].value), { type: 'application/octet-stream' });
        objectUrl = URL.createObjectURL(readyFile);
        let shareable = false;
        try { shareable = Boolean(navigator.share && navigator.canShare?.({ files: [readyFile] })); } catch { /* Download remains available. */ }
        ui['share-button'].hidden = !shareable;
        ui['download-help'].hidden = false;
        status(`Your file is ready (${(readyFile.size / 1024).toFixed(1)} KB). Choose Download${shareable ? ' or Share file' : ''}.`);
        renderExport();
      } catch {
        releaseFile();
        status('Could not prepare a download. Try a smaller set or a current browser.');
        renderExport();
      }
    }
  };
  return worker;
}
function post(message) {
  working = true;
  watchdog = setTimeout(workerFailed, 60000);
  try { getWorker().postMessage(message); } catch { workerFailed(); }
  renderExport();
}
function invalidate() {
  revision += 1;
  clearTimeout(timer);
  if (working) stopWorker();
  finishWork();
  releaseFile();
  cards = [];
  index = 0;
  answer = false;
  ui['input-count'].textContent = '0';
  ui['card-count'].textContent = '0';
  ui['error-message'].hidden = true;
  ui['retry-conversion'].hidden = true;
  text.setAttribute('aria-invalid', 'false');
  status('');
  renderPreview();
  renderExport();
}
function scheduleParse(immediate = false) {
  invalidate();
  if (!text.value.trim()) {
    ui['source-status'].textContent = 'Your study set starts here.';
    return;
  }
  ui['source-status'].textContent = 'Checking your cards…';
  const run = () => post({ id: revision, type: 'parse', text: text.value, reverse: ui['reverse-cards'].checked });
  if (immediate) run(); else timer = setTimeout(run, 200);
}
text.addEventListener('input', () => scheduleParse());
ui['reverse-cards'].addEventListener('change', () => scheduleParse(true));
ui['deck-title'].addEventListener('input', () => {
  // A title edit invalidates any in-flight file as well as any prepared file.
  scheduleParse();
});
ui['load-example'].addEventListener('click', () => {
  text.value = EXAMPLE;
  scheduleParse(true);
  text.focus({ preventScroll: true });
});
ui['clear-input'].addEventListener('click', () => {
  text.value = '';
  ui['file-input'].value = '';
  scheduleParse(true);
  text.focus({ preventScroll: true });
});
ui['retry-conversion'].addEventListener('click', () => scheduleParse(true));
ui['cancel-build'].addEventListener('click', () => {
  scheduleParse(true);
  status('Creation canceled. Your input is unchanged.');
});
ui['choose-file'].addEventListener('click', () => ui['file-input'].click());
async function loadFile(files) {
  if (!files.length) return;
  invalidate();
  const id = revision;
  const file = files[0];
  if (files.length !== 1) return inputError('Choose one CSV or TXT file at a time.');
  if (!/\.(csv|txt)$/i.test(file.name)) return inputError('Choose a .csv or .txt file saved as UTF-8.');
  if (file.size > MAX_INPUT_BYTES) return inputError('File exceeds 2 MiB. Choose a smaller CSV or TXT file.');
  ui['source-status'].textContent = 'Reading your file on this device…';
  ui['drop-zone'].setAttribute('aria-busy', 'true');
  try {
    const buffer = await file.arrayBuffer();
    if (id !== revision) return;
    text.value = decodeFile(buffer);
    scheduleParse(true);
  } catch (error) {
    if (id !== revision) return;
    inputError(error instanceof Error ? error.message : 'Could not read this file. Choose it again.');
  } finally {
    ui['file-input'].value = '';
  }
}
ui['file-input'].addEventListener('change', () => loadFile(Array.from(ui['file-input'].files)));
let dragDepth = 0;
ui['drop-zone'].addEventListener('dragenter', event => { event.preventDefault(); dragDepth += 1; ui['drop-zone'].classList.add('is-dragover'); });
ui['drop-zone'].addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
ui['drop-zone'].addEventListener('dragleave', () => { if (--dragDepth <= 0) ui['drop-zone'].classList.remove('is-dragover'); });
ui['drop-zone'].addEventListener('drop', event => {
  event.preventDefault();
  dragDepth = 0;
  ui['drop-zone'].classList.remove('is-dragover');
  loadFile(Array.from(event.dataTransfer.files));
});
ui['preview-card'].addEventListener('click', () => { answer = !answer; renderPreview(); });
function move(delta) {
  index = Math.max(0, Math.min(cards.length - 1, index + delta));
  answer = false;
  renderPreview();
}
ui['previous-card'].addEventListener('click', () => move(-1));
ui['next-card'].addEventListener('click', () => move(1));
ui['preview-card'].addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
ui['download-button'].addEventListener('click', () => {
  if (working || !cards.length || !titleValid()) return;
  if (!readyFile) {
    building = true;
    status('Creating your study set on this device… You can cancel or keep editing.');
    post({ id: revision, type: 'build', title: ui['deck-title'].value.trim() });
    return;
  }
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = readyFile.name;
  document.body.append(link);
  link.click();
  link.remove();
  status(`Download requested: ${readyFile.name}. Check your browser’s Downloads; this page cannot confirm that it was saved.`);
});
ui['share-button'].addEventListener('click', async () => {
  if (!readyFile || sharing) return;
  const file = readyFile;
  const id = revision;
  sharing = true;
  renderExport();
  try {
    // Nothing asynchronous may run before this call: preserve the user's tap.
    await navigator.share({ files: [file] });
    if (id === revision) status('The share sheet has closed. Check the app you selected to confirm the import.');
  } catch (error) {
    if (id === revision) status(error.name === 'AbortError' ? 'Sharing canceled. You can still download your file.' : 'File sharing was unavailable. Use Download study set instead.');
  } finally { sharing = false; renderExport(); }
});
ui['help-open'].addEventListener('click', () => ui['help-dialog'].showModal());
ui['help-close'].addEventListener('click', () => ui['help-dialog'].close());
ui['help-dialog'].addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...ui['help-dialog'].querySelectorAll('a[href], button, input, textarea, select, [tabindex="0"]')].filter(element => !element.disabled);
  const first = controls[0];
  const last = controls.at(-1);
  if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
});
ui['help-dialog'].addEventListener('click', event => {
  const bounds = ui['help-dialog'].getBoundingClientRect();
  if (event.target === ui['help-dialog'] && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) ui['help-dialog'].close();
});
ui['help-dialog'].addEventListener('close', () => ui['help-open'].focus({ preventScroll: true }));
scheduleParse(true);
