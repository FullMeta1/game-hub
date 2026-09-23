// Event/controller checks in a minimal DOM harness. These are not visual or
// mobile-browser tests; a real browser remains necessary for layout/PWA QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as rules from '../fenghuo-v2/src/game.mjs';

function harness(initial = {}) {
  const elements = new Map(), timers = new Map(), saved = new Map(Object.entries(initial));
  const html = fs.readFileSync(new URL('../fenghuo-v2/index.html', import.meta.url), 'utf8');
  let serial = 0;
  class Element {
    constructor(id, hidden = false) { this.id = id; this.hidden = hidden; this.disabled = false; this.open = false; this.handlers = {}; this.attributes = {}; this.classList = { add() {}, remove() {} }; }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    setAttribute(name, value) { this.attributes[name] = value; }
    set innerHTML(value) { this.html = value; for (const m of value.matchAll(/\bid="([^"]+)"/g)) if (!elements.has(m[1])) elements.set(m[1], new Element(m[1])); }
    get innerHTML() { return this.html || ''; }
    showModal() { this.open = true; }
    close() { const wasOpen = this.open; this.open = false; if (wasOpen) this.dispatch('close'); }
    dispatch(name, event = {}) { if (name === 'click' && this.disabled) throw new Error(`Disabled button ${this.id}`); for (const fn of this.handlers[name] || []) fn(event); if (name === 'click') this.onclick?.(event); }
  }
  for (const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) elements.set(m[1], new Element(m[1], /\shidden(?:\s|>)/.test(m[0])));
  const table = new Element('table');
  const document = { hidden:false, getElementById:id => elements.get(id) || null, querySelector:selector => selector === '.table' ? table : null, addEventListener() {} };
  const context = vm.createContext({
    injectedRules: rules, document, navigator:{}, location:{protocol:'https:'}, console,
    setTimeout: fn => { const id = ++serial; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    localStorage:{ getItem:key => saved.get(key) || null, setItem:(key, value) => saved.set(key, value) },
    addEventListener() {}, scrollTo() {}
  });
  context.window = context;
  const storage = fs.readFileSync(new URL('../fenghuo-v2/src/storage.mjs', import.meta.url), 'utf8').replace('export const storage', 'const storage');
  const ui = fs.readFileSync(new URL('../fenghuo-v2/src/ui.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInContext(`${storage}\nconst { Game, HEROES, CARDS, getHero } = injectedRules;\n${ui}`, context);
  return {
    elements, table, saved, context,
    eval: code => vm.runInContext(code, context),
    click: id => elements.get(id).dispatch('click'),
    card: id => elements.get('hand').dispatch('click', {target:{closest:() => ({dataset:{card:String(id)}})}}),
    target: id => table.dispatch('click', {target:{closest:() => ({dataset:{player:String(id)}})}})
  };
}
function arrange(h, types) {
  h.context.desiredTypes = types;
  h.eval(`game.state.deck.push(...game.player(0).hand.splice(0)); for (const type of desiredTypes) { const zones=[game.state.deck,game.state.discard,...game.state.players.slice(1).map(p=>p.hand)]; const z=zones.find(z=>z.some(c=>c.type===type)); game.player(0).hand.push(z.splice(z.findIndex(c=>c.type===type),1)[0]); } render();`);
}

test('UI: lobby -> battle -> commander skill -> persisted reload', () => {
  const h = harness(); assert.match(h.elements.get('hero-grid').innerHTML, /Su Wantang/);
  h.click('start'); assert.equal(h.elements.get('battle').hidden, false);
  const before = h.eval('game.player(0).hand.length'); h.click('skill');
  assert.equal(h.elements.get('play').disabled, false); h.click('play');
  assert.equal(h.eval('game.player(0).hand.length'), before + 1);
  assert.equal(h.eval('game.player(0).usedSkill'), true);
  const resumed = harness(Object.fromEntries(h.saved)); assert.equal(resumed.elements.get('resume').hidden, false); resumed.click('resume');
  assert.equal(resumed.eval('game.player(0).usedSkill'), true);
});
test('UI: selected attack requires a legal target then consumes the card', () => {
  const h = harness(); h.click('start'); arrange(h, ['strike']); const id = h.eval('game.player(0).hand[0].id');
  h.card(id); assert.equal(h.elements.get('play').disabled, true);
  h.target(2); assert.equal(h.elements.get('play').disabled, true);
  h.target(1); assert.equal(h.elements.get('play').disabled, false); h.click('play');
  assert.equal(h.eval('game.player(0).hand.length'), 0); assert.equal(h.eval('game.player(0).strikes'), 1);
});
test('UI: end turn enters discard and does not trap the player', () => {
  const h = harness(); h.click('start'); arrange(h, ['strike','dodge','fire']); h.eval('game.player(0).hp=1;render();');
  h.click('end-turn'); assert.match(h.elements.get('turn-pill').textContent, /Discard/);
  for (let i = 0; i < 2; i++) { h.card(h.eval('game.player(0).hand[0].id')); h.click('play'); }
  assert.notEqual(h.eval('game.state.turn'), 0); assert.equal(h.eval('game.player(0).hand.length'), 1);
});
test('UI: mobile target selection scrolls to battlefield, self-target cards stay in place', () => {
  const h = harness(); h.click('start'); arrange(h, ['strike', 'draw']);
  let scrolls = 0;
  h.context.matchMedia = query => ({ matches: query.includes('max-width') });
  h.table.scrollIntoView = () => { scrolls++; };
  h.card(h.eval('game.player(0).hand.find(c => c.type === "draw").id'));
  assert.equal(scrolls, 0);
  h.card(h.eval('game.player(0).hand.find(c => c.type === "strike").id'));
  assert.equal(scrolls, 1);
});
test('UI: swapping generals preserves save until explicit new game', () => {
  const h = harness(); h.click('start'); const before = h.saved.get('fenghuo.v2.match'); h.click('new-game');
  assert.equal(h.elements.get('lobby').hidden, false); assert.equal(h.saved.get('fenghuo.v2.match'), before);
  h.click('start'); assert.equal(h.elements.get('modal').open, true); h.click('keep-save');
  assert.equal(h.saved.get('fenghuo.v2.match'), before);
});
test('UI: result counts once and a completed game cannot continue', () => {
  const h = harness(); h.click('start'); h.eval('game.state.phase="over";game.state.winner=0;render();render();');
  const stats = JSON.parse(h.saved.get('fenghuo.v2.record')); assert.equal(stats.played, 1); assert.equal(stats.won, 1);
  assert.equal(h.elements.get('play').disabled, true); assert.equal(h.elements.get('modal').open, true);
  h.click('again'); assert.equal(h.elements.get('resume').hidden, true);
});
test('UI: all static, module and offline resources exist', () => {
  const root = new URL('../', import.meta.url);
  for (const folder of ['fenghuo','fenghuo-v2']) {
    const base = new URL(`${folder}/`, root), html = fs.readFileSync(new URL('index.html', base), 'utf8');
    for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      assert.ok(fs.existsSync(new URL(m[1], base)), `${folder}: missing ${m[1]}`);
    }
    const manifest = JSON.parse(fs.readFileSync(new URL('manifest.webmanifest', base), 'utf8'));
    for (const icon of manifest.icons) assert.ok(fs.existsSync(new URL(icon.src, base)), `Missing icon ${icon.src}`);
    const sw = fs.readFileSync(new URL('sw.js', base), 'utf8');
    for (const m of sw.match(/const ASSETS = \[([^\]]+)\]/s)[1].matchAll(/'([^']+)'/g)) assert.ok(fs.existsSync(new URL(m[1], base)), `Cache asset missing: ${m[1]}`);
  }
});
test('UI: the playable English edition has no Chinese interface strings', () => {
  for (const file of ['index.html','manifest.webmanifest','src/ui.mjs','src/data.mjs','src/game.mjs','src/cards.mjs','src/turns.mjs','src/skills.mjs']) {
    const content = fs.readFileSync(new URL(`../fenghuo-v2/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(content,/\p{Script=Han}/u,file);
  }
});
