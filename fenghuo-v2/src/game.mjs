import { VERSION, HEROES, CARDS, getHero } from './data.mjs';
import { cardActions } from './cards.mjs';
import { turnActions } from './turns.mjs';
import { skillActions } from './skills.mjs';
import { aiActions } from './ai.mjs';

// Pure state facade: no browser, timer, storage or network dependencies.
export class Game {
  constructor(heroId = 'xiao', seed = Date.now()) {
    if (!getHero(heroId)) throw new Error('Unknown commander');
    this.state = { version: VERSION, rng: (Number(seed) >>> 0) || 1, players: [], deck: [], discard: [], turn: 0, round: 1, phase: 'play', winner: null, serial: 0, log: [], stats: { damage: 0, cards: 0 }, recorded: false };
    const rest = this.shuffle(HEROES.filter(h => h.id !== heroId).map(h => h.id));
    [heroId, ...rest.slice(0, 3)].forEach((id, i) => {
      const h = getHero(id);
      this.state.players.push({ id: i, heroId: id, team: i % 2, hp: h.hp, maxHp: h.hp, armor: 0, hand: [], alive: true, usedSkill: false, strikes: 0, boosted: false });
    });
    for (const [type, card] of Object.entries(CARDS)) for (let i = 0; i < card.count; i++) this.state.deck.push({ id: this.state.serial++, type });
    this.shuffle(this.state.deck);
    this.state.players.forEach(p => this.draw(p.id, 4, false));
    this.log('Azure faces Crimson. Defeat both enemy commanders to win.', 'system');
    this.beginTurn();
  }
  static restore(data) {
    if (!data || data.version !== VERSION || !Array.isArray(data.players) || data.players.length !== 4 || !['play', 'discard', 'over'].includes(data.phase)) throw new Error('Invalid saved game');
    const copy = JSON.parse(JSON.stringify(data));
    const zones = [copy.deck, copy.discard, ...copy.players.map(p => p.hand)];
    if (zones.some(z => !Array.isArray(z)) || !Number.isInteger(copy.turn) || copy.turn < 0 || copy.turn > 3 || !Number.isInteger(copy.round) || copy.round < 1 || !Array.isArray(copy.log) || !copy.stats || !Number.isFinite(copy.stats.damage) || !Number.isFinite(copy.stats.cards) || !Number.isFinite(copy.rng)) throw new Error('Damaged saved game');
    const cards = zones.flat();
    if (cards.length !== 84 || new Set(cards.map(c => c.id)).size !== 84 || cards.some(c => !CARDS[c.type] || !Number.isInteger(c.id) || c.id < 0 || c.id >= 84)) throw new Error('Damaged card deck');
    copy.players.forEach((p, i) => {
      const h = getHero(p.heroId);
      if (!h || p.id !== i || p.team !== i % 2 || p.maxHp !== h.hp || !Number.isInteger(p.hp) || p.hp < 0 || p.hp > p.maxHp || p.alive !== (p.hp > 0) || !Number.isInteger(p.armor) || p.armor < 0 || p.armor > 2 || !Number.isInteger(p.strikes) || p.strikes < 0) throw new Error('Damaged commander state');
    });
    if ((copy.phase === 'over') !== (copy.winner === 0 || copy.winner === 1) || (copy.phase !== 'over' && !copy.players[copy.turn].alive)) throw new Error('Damaged turn state');
    const game = Object.create(Game.prototype);
    game.state = copy;
    return game;
  }
  random() { let x = this.state.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.state.rng = x >>> 0; return this.state.rng / 4294967296; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  player(id) { return this.state.players[id]; }
  name(id) { return getHero(this.player(id).heroId).name; }
  log(text, type = 'normal') { this.state.log.push({ text, type, round: this.state.round }); if (this.state.log.length > 160) this.state.log.shift(); }
  draw(id, n, report = true) {
    const p = this.player(id); let count = 0;
    for (let i = 0; i < n; i++) {
      if (!this.state.deck.length && this.state.discard.length) { this.state.deck = this.shuffle(this.state.discard.splice(0)); this.log('The discard pile was shuffled into the deck.', 'system'); }
      if (!this.state.deck.length) break;
      p.hand.push(this.state.deck.pop()); count++;
    }
    if (report && count) this.log(`${this.name(id)} drew ${count} ${count === 1 ? 'card' : 'cards'}.`);
    return count;
  }
  consume(id, cardId) { const p = this.player(id); const i = p.hand.findIndex(c => c.id === cardId); if (i < 0) return null; const [c] = p.hand.splice(i, 1); this.state.discard.push(c); return c; }
  consumeType(id, type) { const c = this.player(id).hand.find(c => c.type === type); return c ? this.consume(id, c.id) : null; }
  allies(id) { return this.state.players.filter(p => p.alive && p.team === this.player(id).team); }
  enemies(id) { return this.state.players.filter(p => p.alive && p.team !== this.player(id).team); }
}
Object.assign(Game.prototype, cardActions, turnActions, skillActions, aiActions);
export { VERSION, HEROES, CARDS, getHero };
