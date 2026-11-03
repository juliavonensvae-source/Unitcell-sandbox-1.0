/* Shared test helpers: build a SceneModel for a lattice and run input-bar commands on it. */
import { SceneModel } from '../src/objects/model.js';
import { getType } from '../src/objects/index.js';
import { BRAVAIS, defaultSetting, defaultParams } from '../src/data/bravais.js';

export const model = (id = 'cP', { setting, params, prism = false, mode = 'crystal' } = {}) => {
  const m = new SceneModel({ mode }), b = BRAVAIS.find(x => x.id === id);
  m.state.latticeId = id;
  m.state.setting = setting || defaultSetting(b);
  m.state.params = params || defaultParams(b, m.state.setting);
  if (prism) m.state.hexCell = 'prism';
  m.recompute();
  return m;
};

/** Runs an input-bar line; throws on an error. Returns the new item, or the whole result with `full`. */
export const run = (m, text, { full = false } = {}) => {
  const res = m.runCommand(text);
  if (res.error) throw new Error(`${text}: ${res.error}`);
  return full ? res : res.item;
};

export const finitePrims = prims => JSON.stringify(prims, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'BAD' : v)).indexOf('"BAD"') < 0;

export const plain = html => html.replace(/<[^>]+>/g, '');

/** The plain-text summary line of an item. */
export const sum = (m, it) => plain(getType(it.type).summary(it, m.ctx));
