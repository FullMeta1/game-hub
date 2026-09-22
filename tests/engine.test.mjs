import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Game as ModularGame } from '../fenghuo-v2/src/game.mjs';
import { storage } from '../fenghuo-v2/src/storage.mjs';
const require = createRequire(import.meta.url);
const { Game: OriginalGame, HEROES, CARDS } = require('../fenghuo/engine.js');

function hand(game, id, types) {
  const s = game.state, p = game.player(id);
  s.deck.push(...p.hand.splice(0));
  for (const type of types) {
    const zones = [s.deck, s.discard, ...s.players.filter(x => x.id !== id).map(x => x.hand)];
    const zone = zones.find(z => z.some(c => c.type === type));
    assert.ok(zone, `No available ${type}`);
    p.hand.push(zone.splice(zone.findIndex(c => c.type === type), 1)[0]);
  }
  return p.hand;
}
function id(game, playerId, type) { return game.player(playerId).hand.find(c => c.type === type).id; }
function valid(game) {
  const s = game.state;
  const cards = [...s.deck, ...s.discard, ...s.players.flatMap(p => p.hand)];
  assert.equal(cards.length, 84);
  assert.equal(new Set(cards.map(c => c.id)).size, 84);
  for (const [type, meta] of Object.entries(CARDS)) assert.equal(cards.filter(c => c.type === type).length, meta.count);
  for (const p of s.players) {
    assert.ok(p.hp >= 0 && p.hp <= p.maxHp);
    assert.equal(p.alive, p.hp > 0);
    assert.ok(p.armor >= 0 && p.armor <= 2);
    if (!p.alive) assert.equal(p.hand.length, 0);
  }
  if (s.phase !== 'over') assert.ok(game.player(s.turn).alive);
}

for (const [version, Game] of [['original', OriginalGame], ['modular', ModularGame]]) {
  test(`${version}: deterministic initialization and 84-card conservation`, () => {
    const a = new Game('xiao', 123), b = new Game('xiao', 123);
    assert.deepEqual(a.state, b.state);
    assert.equal(new Set(a.state.players.map(p => p.heroId)).size, 4);
    assert.equal(a.player(0).hand.length, 6);
    assert.equal(a.player(2).team, 0);
    valid(a);
  });
  test(`${version}: invalid target does not consume a card or mutate state`, () => {
    const g = new Game('xiao', 2); hand(g, 0, ['strike']);
    const before = JSON.stringify(g.state);
    assert.equal(g.play(0, id(g, 0, 'strike'), 2).ok, false);
    assert.equal(JSON.stringify(g.state), before);
    assert.equal(g.play(1, -1, 0).ok, false);
  });
  test(`${version}: dodge, armor, then health resolve in order`, () => {
    const g = new Game('gu', 3); hand(g, 0, ['strike', 'strike', 'fire']); hand(g, 1, ['dodge']);
    const p = g.player(1), hp = p.hp; p.armor = 1;
    g.play(0, id(g, 0, 'strike'), 1); assert.equal(p.hp, hp); assert.equal(p.armor, 1); assert.equal(p.hand.length, 0);
    g.play(0, id(g, 0, 'strike'), 1); assert.equal(p.hp, hp); assert.equal(p.armor, 0);
    g.play(0, id(g, 0, 'fire'), 1); assert.equal(p.hp, hp - 1); valid(g);
  });
  test(`${version}: fire bypasses dodge but not armor`, () => {
    const g = new Game('xiao', 4); hand(g, 0, ['fire']); hand(g, 1, ['dodge']);
    const p = g.player(1); p.armor = 1; const hp = p.hp;
    g.play(0, id(g, 0, 'fire'), 1);
    assert.equal(p.hp, hp); assert.equal(p.armor, 0); assert.equal(p.hand.length, 1);
  });
  test(`${version}: strikes limited, commander skill limited`, () => {
    const g = new Game('xiao', 5); hand(g, 0, ['strike', 'strike']); hand(g, 1, []); g.player(1).armor = 0;
    assert.equal(g.play(0, id(g, 0, 'strike'), 1).ok, true);
    assert.equal(g.play(0, id(g, 0, 'strike'), 1).ok, false);
    const n = g.player(0).hand.length; assert.equal(g.useSkill(0, 0).ok, true); assert.equal(g.player(0).hand.length, n + 1);
    assert.equal(g.useSkill(0, 0).ok, false);
  });
  test(`${version}: dying auto-rescue consumes only needed heals`, () => {
    const g = new Game('xiao', 6); hand(g, 0, ['fire']); hand(g, 1, ['heal', 'dodge']);
    g.player(1).hp = 1; g.player(1).armor = 0;
    g.play(0, id(g, 0, 'fire'), 1);
    assert.equal(g.player(1).hp, 1); assert.equal(g.player(1).alive, true);
    assert.deepEqual(g.player(1).hand.map(c => c.type), ['dodge']); valid(g);
  });
  test(`${version}: enhanced strike can need two self-rescues`, () => {
    const g = new Game('xiao', 7); hand(g, 0, ['strike']); hand(g, 1, ['heal', 'heal']);
    g.player(0).boosted = true; g.player(1).hp = 1; g.player(1).armor = 0;
    g.play(0, id(g, 0, 'strike'), 1);
    assert.equal(g.player(1).hp, 1); assert.equal(g.player(1).hand.length, 0); assert.equal(g.player(0).boosted, false); valid(g);
  });
  test(`${version}: dying during your duel advances turn`, () => {
    const g = new Game('xiao', 8); hand(g, 0, ['duel']); hand(g, 1, ['strike']); g.player(0).hp = 1;
    g.play(0, id(g, 0, 'duel'), 1);
    assert.equal(g.player(0).alive, false); assert.notEqual(g.state.turn, 0); assert.equal(g.state.phase, 'play'); valid(g);
  });
  test(`${version}: healer pays a selected card, validates target`, () => {
    const g = new Game('su', 9); hand(g, 0, ['dodge']); const cost = g.player(0).hand[0].id; g.player(2).hp--;
    assert.equal(g.useSkill(0, 2, -1).ok, false); assert.equal(g.useSkill(0, 1, cost).ok, false);
    const hp = g.player(2).hp; assert.equal(g.useSkill(0, 2, cost).ok, true);
    assert.equal(g.player(2).hp, hp + 1); assert.equal(g.player(0).hand.length, 0); valid(g);
  });
  test(`${version}: steal and disarm conserve cards`, () => {
    const g = new Game('lu', 10); hand(g, 0, ['dodge', 'disarm']); hand(g, 1, ['heal', 'dodge']); g.player(1).armor = 2;
    const n = g.player(1).hand.length;
    assert.equal(g.useSkill(0, 1, id(g, 0, 'dodge')).ok, true); assert.equal(g.player(1).hand.length, n - 1);
    assert.equal(g.play(0, id(g, 0, 'disarm'), 1).ok, true); assert.equal(g.player(1).armor, 0); assert.equal(g.player(1).hand.length, 0); valid(g);
  });
  test(`${version}: discard phase ends at current health limit`, () => {
    const g = new Game('xiao', 11); hand(g, 0, ['dodge', 'strike', 'fire']); g.player(0).hp = 1;
    g.endTurn(0); assert.equal(g.state.phase, 'discard');
    g.discardCard(0, g.player(0).hand[0].id); assert.equal(g.state.turn, 0);
    g.discardCard(0, g.player(0).hand[0].id); assert.equal(g.player(0).hand.length, 1); assert.notEqual(g.state.turn, 0); valid(g);
  });
  test(`${version}: arrow rain eliminates opponents and ends match`, () => {
    const g = new Game('xiao', 12); hand(g, 0, ['arrows']);
    for (const i of [1, 3]) { hand(g, i, []); g.player(i).hp = 1; g.player(i).armor = 0; }
    g.play(0, id(g, 0, 'arrows'), 0);
    assert.equal(g.state.phase, 'over'); assert.equal(g.state.winner, 0); valid(g);
    const before = JSON.stringify(g.state); g.aiStep(); assert.equal(JSON.stringify(g.state), before);
  });
  test(`${version}: fatigue ignores armor and can be self-rescued`, () => {
    const g = new Game('xiao', 13); hand(g, 0, ['heal']); const p = g.player(0); p.hp = 1; p.armor = 2; g.state.round = 20;
    g.beginTurn(); assert.equal(p.hp, 1); assert.equal(p.armor, 2); assert.ok(p.alive); valid(g);
  });
  test(`${version}: deck reshuffles without manufacturing cards`, () => {
    const g = new Game('xiao', 14); g.state.discard.push(...g.state.deck.splice(0));
    const n = g.player(0).hand.length; assert.equal(g.draw(0, 3), 3); assert.equal(g.player(0).hand.length, n + 3); valid(g);
  });
  test(`${version}: AI decisions do not inspect enemy card types`, () => {
    const g = new Game('gu', 15); hand(g, 0, ['fire', 'strike']); hand(g, 1, ['dodge', 'dodge']);
    const a = g.chooseAI(); hand(g, 1, ['heal', 'heal']); assert.deepEqual(g.chooseAI(), a);
  });
  test(`${version}: saved state validates and resumes deterministically`, () => {
    const g = new Game('shen', 16); for (let i = 0; i < 10; i++) g.aiStep();
    const resumed = Game.restore(JSON.parse(JSON.stringify(g.state)));
    g.aiStep(); resumed.aiStep(); assert.deepEqual(resumed.state, g.state);
    const bad = JSON.parse(JSON.stringify(g.state)); bad.players[0].hand.push(bad.deck[0]); assert.throws(() => Game.restore(bad));
    assert.throws(() => Game.restore({}));
  });
  test(`${version}: 120 seeded matches finish legally with all heroes`, () => {
    for (let seed = 1; seed <= 120; seed++) {
      let g = new Game(HEROES[seed % 6].id, seed), steps = 0;
      while (g.state.phase !== 'over' && steps < 2500) {
        const result = g.aiStep(); assert.notEqual(result?.ok, false, `Illegal AI move, seed ${seed}`);
        valid(g); steps++;
        if (steps % 25 === 0) g = Game.restore(g.state);
      }
      assert.equal(g.state.phase, 'over', `Stalled match at seed ${seed}`);
      assert.ok(g.state.winner === 0 || g.state.winner === 1);
    }
  });
}

test('storage failure is safe and new keys do not replace old saves', () => {
  const entries = new Map([['fenghuo.match.v1', 'old-save']]);
  globalThis.localStorage = { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value) };
  assert.equal(storage.write('match', { turn:0 }), true);
  assert.equal(entries.get('fenghuo.match.v1'), 'old-save');
  assert.deepEqual(storage.read('match', null), { turn:0 });
  entries.set('fenghuo.v2.preferences', 'false');
  assert.deepEqual(storage.read('preferences', { sound:false }), { sound:false });
  globalThis.localStorage = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); } };
  assert.equal(storage.read('match', null), null); assert.equal(storage.write('match', {}), false);
  delete globalThis.localStorage;
});
