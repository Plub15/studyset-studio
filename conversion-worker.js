import { parseCards, buildGoodnotes } from './converter.js';
import { validateSize, validateCards } from './app-utils.js';

let cards = [];
let revision = -1;
self.onmessage = ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'parse') {
      cards = [];
      revision = -1;
      validateSize(data.text);
      const parsed = parseCards(data.text, { reverse: data.reverse });
      validateCards(parsed);
      cards = parsed;
      revision = id;
      self.postMessage({ id, type: 'parsed', cards, pairs: cards.length / (data.reverse ? 2 : 1) });
    } else if (type === 'build') {
      if (id !== revision || !cards.length) throw new Error('The input changed. Check your cards and create the file again.');
      const bytes = buildGoodnotes(cards, data.title);
      self.postMessage({ id, type: 'built', bytes }, [bytes.buffer]);
    }
  } catch (error) {
    self.postMessage({ id, type: 'error', operation: type, message: error instanceof Error ? error.message : 'Could not convert this study set.' });
  }
};
