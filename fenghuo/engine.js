(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Fenghuo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const HEROES = [
    { id: 'xiao', name: '萧策', title: '运筹之将', mark: '策', hp: 4, skill: '筹谋', type: 'active', target: 'self', color: 'gold', desc: '每回合限一次，额外摸一张牌。', flavor: '局势在变，胜算在握。' },
    { id: 'gu', name: '顾长风', title: '踏阵之锋', mark: '锋', hp: 4, skill: '疾袭', type: 'passive', color: 'red', desc: '每回合可使用两张「破阵」。', flavor: '风过之处，阵无完壁。' },
    { id: 'chu', name: '褚山', title: '不动之垒', mark: '山', hp: 5, skill: '铁壁', type: 'passive', color: 'blue', desc: '自己的回合开始时获得一层护甲，最多两层。', flavor: '一人立，万骑止。' },
    { id: 'su', name: '苏晚棠', title: '悬壶之心', mark: '棠', hp: 3, skill: '济世', type: 'active', target: 'ally', cost: true, color: 'green', desc: '每回合限一次，弃一张手牌，为一名友方恢复一点体力。', flavor: '烽烟不掩，一线生机。' },
    { id: 'lu', name: '陆隐', title: '无声之刃', mark: '隐', hp: 4, skill: '夜取', type: 'active', target: 'enemyHand', cost: true, color: 'purple', desc: '每回合限一次，弃一张手牌，随机夺取一名敌方的一张手牌。', flavor: '灯影未动，胜负已移。' },
    { id: 'shen', name: '沈知微', title: '观星之智', mark: '星', hp: 3, skill: '远略', type: 'passive', color: 'teal', desc: '摸牌阶段额外摸一张牌。', flavor: '落子之前，已见终章。' }
  ];
  const CARDS = {
    strike: { name: '破阵', glyph: '击', kind: '基本', color: 'red', count: 24, target: 'enemy', text: '造成 1 点伤害。每回合限一次；闪避可抵消。' },
    dodge: { name: '闪避', glyph: '闪', kind: '应对', color: 'blue', count: 16, target: 'none', text: '受到破阵或箭雨时自动消耗，抵消本次攻击。' },
    heal: { name: '军医', glyph: '愈', kind: '基本', color: 'green', count: 8, target: 'ally', text: '为一名友方恢复 1 点体力；濒死时自动自救。' },
    draw: { name: '粮草', glyph: '粮', kind: '锦囊', color: 'gold', count: 6, target: 'self', text: '摸两张牌。' },
    fire: { name: '火攻', glyph: '焰', kind: '锦囊', color: 'red', count: 6, target: 'enemy', text: '对一名敌方造成 1 点伤害，无法闪避。' },
    duel: { name: '对决', glyph: '决', kind: '锦囊', color: 'purple', count: 4, target: 'enemy', text: '从目标开始，双方自动轮流打出破阵；先无法打出者受 1 点伤害。' },
    steal: { name: '奇策', glyph: '谋', kind: '锦囊', color: 'purple', count: 4, target: 'enemyHand', text: '随机夺取一名敌方的一张手牌。' },
    disarm: { name: '缴械', glyph: '夺', kind: '锦囊', color: 'gold', count: 3, target: 'enemyResource', text: '移除一名敌方全部护甲，并随机弃掉其一张手牌。' },
    arrows: { name: '箭雨', glyph: '雨', kind: '锦囊', color: 'red', count: 3, target: 'self', text: '对每名敌方造成 1 点伤害；分别可用闪避抵消。' },
    shield: { name: '护甲', glyph: '甲', kind: '装备', color: 'blue', count: 3, target: 'self', text: '将自己的护甲补至两层。每层抵消 1 点伤害。' },
    rally: { name: '军令', glyph: '令', kind: '锦囊', color: 'gold', count: 3, target: 'self', text: '本回合下一次破阵伤害 +1，并摸一张牌；效果不叠加。' },
    mend: { name: '整备', glyph: '备', kind: '锦囊', color: 'green', count: 4, target: 'self', text: '自己恢复 1 点体力，并摸一张牌。' }
  };
  const getHero = id => HEROES.find(h => h.id === id);
  class Game {
    constructor(heroId = 'xiao', seed = Date.now()) {
      if (!getHero(heroId)) throw new Error('未知武将');
      this.state = { version: VERSION, rng: (Number(seed) >>> 0) || 1, players: [], deck: [], discard: [], turn: 0, round: 1, phase: 'play', winner: null, serial: 0, log: [], stats: { damage: 0, cards: 0 }, recorded: false };
      const rest = this.shuffle(HEROES.filter(h => h.id !== heroId).map(h => h.id));
      [heroId, ...rest.slice(0, 3)].forEach((id, i) => {
        const h = getHero(id);
        this.state.players.push({ id: i, heroId: id, team: i % 2, hp: h.hp, maxHp: h.hp, armor: 0, hand: [], alive: true, usedSkill: false, strikes: 0, boosted: false });
      });
      for (const [type, card] of Object.entries(CARDS)) for (let i = 0; i < card.count; i++) this.state.deck.push({ id: this.state.serial++, type });
      this.shuffle(this.state.deck);
      this.state.players.forEach(p => this.draw(p.id, 4, false));
      this.log('青锋与赤霄列阵。击败全部敌将即可获胜。', 'system');
      this.beginTurn();
    }
    static restore(data) {
      if (!data || data.version !== VERSION || !Array.isArray(data.players) || data.players.length !== 4 || !['play', 'discard', 'over'].includes(data.phase)) throw new Error('存档无效');
      const copy = JSON.parse(JSON.stringify(data));
      const zones = [copy.deck, copy.discard, ...copy.players.map(p => p.hand)];
      if (zones.some(z => !Array.isArray(z)) || !Number.isInteger(copy.turn) || copy.turn < 0 || copy.turn > 3 || !Number.isInteger(copy.round) || copy.round < 1 || !Array.isArray(copy.log) || !copy.stats || !Number.isFinite(copy.stats.damage) || !Number.isFinite(copy.stats.cards) || !Number.isFinite(copy.rng)) throw new Error('存档损坏');
      const cards = zones.flat();
      if (cards.length !== 84 || new Set(cards.map(c => c.id)).size !== 84 || cards.some(c => !CARDS[c.type] || !Number.isInteger(c.id) || c.id < 0 || c.id >= 84)) throw new Error('牌堆损坏');
      copy.players.forEach((p, i) => {
        const h = getHero(p.heroId);
        if (!h || p.id !== i || p.team !== i % 2 || p.maxHp !== h.hp || !Number.isInteger(p.hp) || p.hp < 0 || p.hp > p.maxHp || p.alive !== (p.hp > 0) || !Number.isInteger(p.armor) || p.armor < 0 || p.armor > 2 || !Number.isInteger(p.strikes) || p.strikes < 0) throw new Error('武将状态损坏');
      });
      if ((copy.phase === 'over') !== (copy.winner === 0 || copy.winner === 1) || (copy.phase !== 'over' && !copy.players[copy.turn].alive)) throw new Error('回合状态损坏');
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
        if (!this.state.deck.length && this.state.discard.length) { this.state.deck = this.shuffle(this.state.discard.splice(0)); this.log('弃牌重新洗入牌堆。', 'system'); }
        if (!this.state.deck.length) break;
        p.hand.push(this.state.deck.pop()); count++;
      }
      if (report && count) this.log(`${this.name(id)}摸了 ${count} 张牌。`);
      return count;
    }
    consume(id, cardId) { const p = this.player(id); const i = p.hand.findIndex(c => c.id === cardId); if (i < 0) return null; const [c] = p.hand.splice(i, 1); this.state.discard.push(c); return c; }
    consumeType(id, type) { const c = this.player(id).hand.find(c => c.type === type); return c ? this.consume(id, c.id) : null; }
    strikeLimit(id) { return this.player(id).heroId === 'gu' ? 2 : 1; }
    allies(id) { return this.state.players.filter(p => p.alive && p.team === this.player(id).team); }
    enemies(id) { return this.state.players.filter(p => p.alive && p.team !== this.player(id).team); }
    targetsFor(id, target) {
      if (target === 'self') return [id];
      if (target === 'ally') return this.allies(id).filter(p => p.hp < p.maxHp).map(p => p.id);
      if (target === 'enemy') return this.enemies(id).map(p => p.id);
      if (target === 'enemyHand') return this.enemies(id).filter(p => p.hand.length).map(p => p.id);
      if (target === 'enemyResource') return this.enemies(id).filter(p => p.hand.length || p.armor).map(p => p.id);
      return [];
    }
    cardError(id, cardId) {
      const s = this.state, p = this.player(id), c = p?.hand.find(c => c.id === cardId);
      if (s.phase !== 'play' || s.turn !== id || !p?.alive) return '现在不是你的出牌阶段';
      if (!c) return '手牌不存在';
      if (c.type === 'dodge') return '闪避会在受到攻击时自动打出';
      if (c.type === 'strike' && p.strikes >= this.strikeLimit(id)) return '本回合破阵次数已用完';
      if (c.type === 'shield' && p.armor >= 2) return '护甲已经满了';
      if (c.type === 'rally' && p.boosted) return '军令已经生效，先使用破阵';
      if (!this.targetsFor(id, CARDS[c.type].target).length) return '没有可用的目标';
      return '';
    }
    cardTargets(id, cardId) { const c = this.player(id)?.hand.find(c => c.id === cardId); return c && !this.cardError(id, cardId) ? this.targetsFor(id, CARDS[c.type].target) : []; }
    skillError(id, costId) {
      const p = this.player(id), h = getHero(p?.heroId);
      if (this.state.phase !== 'play' || this.state.turn !== id || !p?.alive) return '现在不是你的出牌阶段';
      if (h.type !== 'active') return '这是自动生效的被动技能';
      if (p.usedSkill) return '本回合技能已用过';
      if (!this.targetsFor(id, h.target).length) return '没有可用的技能目标';
      if (h.cost && !p.hand.some(c => c.id === costId)) return '先选择一张手牌作为技能代价';
      return '';
    }
    skillTargets(id, costId) { return this.skillError(id, costId) ? [] : this.targetsFor(id, getHero(this.player(id).heroId).target); }
    heal(id, amount) { const p = this.player(id); if (!p.alive) return; const gain = Math.min(amount, p.maxHp - p.hp); p.hp += gain; if (gain) this.log(`${this.name(id)}恢复 ${gain} 点体力。`, 'heal'); }
    damage(source, target, amount, evadable = false, ignoreArmor = false) {
      const p = this.player(target); if (!p.alive || this.state.phase === 'over') return;
      if (evadable && this.consumeType(target, 'dodge')) { this.log(`${this.name(target)}打出「闪避」，避开攻击。`, 'defend'); return; }
      const absorbed = ignoreArmor ? 0 : Math.min(p.armor, amount);
      p.armor -= absorbed; amount -= absorbed;
      if (absorbed) this.log(`${this.name(target)}的护甲抵消 ${absorbed} 点伤害。`, 'defend');
      if (!amount) return;
      p.hp -= amount;
      if (source === 0) this.state.stats.damage += amount;
      this.log(`${this.name(target)}受到 ${amount} 点伤害。`, 'damage');
      while (p.hp <= 0 && this.consumeType(target, 'heal')) { p.hp++; this.log(`${this.name(target)}自动使用「军医」自救。`, 'heal'); }
      if (p.hp <= 0) {
        p.hp = 0; p.alive = false; p.armor = 0;
        this.state.discard.push(...p.hand.splice(0));
        this.log(`${this.name(target)}退场。`, 'damage');
        this.checkWinner();
      }
    }
    checkWinner() { const teams = new Set(this.state.players.filter(p => p.alive).map(p => p.team)); if (teams.size === 1) { this.state.winner = [...teams][0]; this.state.phase = 'over'; this.log(`${this.state.winner === 0 ? '青锋' : '赤霄'}军获胜！`, 'system'); } }
    takeRandom(from, to) { const p = this.player(from); if (!p.hand.length) return; const [c] = p.hand.splice(Math.floor(this.random() * p.hand.length), 1); if (to === null) this.state.discard.push(c); else this.player(to).hand.push(c); }
    play(id, cardId, targetId) {
      const error = this.cardError(id, cardId); if (error) return { ok: false, error };
      const p = this.player(id), c = p.hand.find(c => c.id === cardId), meta = CARDS[c.type];
      const target = targetId ?? (meta.target === 'self' ? id : null);
      if (!this.cardTargets(id, cardId).includes(target)) return { ok: false, error: '请选择高亮的有效目标' };
      this.consume(id, cardId);
      if (id === 0) this.state.stats.cards++;
      this.log(`${this.name(id)}${target !== id ? `对${this.name(target)}` : ''}使用「${meta.name}」。`, 'play');
      switch (c.type) {
        case 'strike': { p.strikes++; const amount = p.boosted ? 2 : 1; p.boosted = false; this.damage(id, target, amount, true); break; }
        case 'heal': this.heal(target, 1); break;
        case 'draw': this.draw(id, 2); break;
        case 'fire': this.damage(id, target, 1); break;
        case 'duel': { let responder = target, other = id; while (this.consumeType(responder, 'strike')) { this.log(`${this.name(responder)}以「破阵」应战。`); [responder, other] = [other, responder]; } this.damage(other, responder, 1); break; }
        case 'steal': this.takeRandom(target, id); break;
        case 'disarm': this.player(target).armor = 0; this.takeRandom(target, null); break;
        case 'arrows': this.enemies(id).forEach(e => this.damage(id, e.id, 1, true)); break;
        case 'shield': p.armor = 2; break;
        case 'rally': p.boosted = true; this.draw(id, 1); break;
        case 'mend': this.heal(id, 1); this.draw(id, 1); break;
      }
      if (this.state.phase !== 'over' && !p.alive) this.advance();
      return { ok: true };
    }
    useSkill(id, targetId, costId) {
      const error = this.skillError(id, costId); if (error) return { ok: false, error };
      const p = this.player(id), h = getHero(p.heroId), target = targetId ?? id;
      if (!this.skillTargets(id, costId).includes(target)) return { ok: false, error: '请选择有效的技能目标' };
      p.usedSkill = true;
      if (h.cost) this.consume(id, costId);
      this.log(`${this.name(id)}发动「${h.skill}」。`, 'skill');
      if (p.heroId === 'xiao') this.draw(id, 1);
      if (p.heroId === 'su') this.heal(target, 1);
      if (p.heroId === 'lu') this.takeRandom(target, id);
      return { ok: true };
    }
    beginTurn() {
      const s = this.state, p = this.player(s.turn); if (s.phase === 'over') return;
      s.phase = 'play'; p.strikes = 0; p.usedSkill = false; p.boosted = false;
      this.log(`${this.name(p.id)}的回合。`, 'turn');
      if (s.round >= 20) { this.log('鏖战：回合开始失去 1 点体力，无视护甲。', 'system'); this.damage(null, p.id, 1, false, true); if (s.phase === 'over') return; if (!p.alive) { this.advance(); return; } }
      if (p.heroId === 'chu') { p.armor = Math.min(2, p.armor + 1); this.log('「铁壁」：获得一层护甲。', 'skill'); }
      this.draw(p.id, p.heroId === 'shen' ? 3 : 2);
    }
    handLimit(id) { return Math.max(1, this.player(id).hp); }
    endTurn(id) {
      if (this.state.turn !== id || this.state.phase !== 'play') return { ok: false, error: '无法结束当前阶段' };
      const p = this.player(id); p.boosted = false;
      if (p.hand.length > this.handLimit(id)) { this.state.phase = 'discard'; this.log(`${this.name(id)}进入弃牌阶段。`); return { ok: true }; }
      this.advance(); return { ok: true };
    }
    discardCard(id, cardId) {
      if (this.state.turn !== id || this.state.phase !== 'discard' || !this.player(id).hand.some(c => c.id === cardId)) return { ok: false, error: '不能弃这张牌' };
      const c = this.consume(id, cardId); this.log(`${this.name(id)}弃置「${CARDS[c.type].name}」。`);
      if (this.player(id).hand.length <= this.handLimit(id)) this.advance();
      return { ok: true };
    }
    advance() {
      if (this.state.phase === 'over') return;
      for (let i = 0; i < 4; i++) { this.state.turn = (this.state.turn + 1) % 4; if (this.state.turn === 0) this.state.round++; if (this.player(this.state.turn).alive) break; }
      this.beginTurn();
    }
    cardValue(card, p) {
      const base = { strike: 5, dodge: 7, heal: 8, draw: 9, fire: 7, duel: 4, steal: 5, disarm: 4, arrows: 7, shield: 6, rally: 4, mend: 8 };
      return base[card.type] + ((card.type === 'heal' || card.type === 'mend') && p.hp <= 2 ? 6 : 0) - (card.type === 'strike' && p.strikes >= this.strikeLimit(p.id) ? 3 : 0);
    }
    chooseAI() {
      const s = this.state, id = s.turn, p = this.player(id), h = getHero(p.heroId);
      if (s.phase === 'over') return null;
      const cheapest = [...p.hand].sort((a, b) => this.cardValue(a, p) - this.cardValue(b, p))[0];
      if (s.phase === 'discard') return { type: 'discard', cardId: cheapest.id };
      if (h.type === 'active' && !this.skillError(id, cheapest?.id)) {
        const targets = this.skillTargets(id, cheapest?.id);
        if (p.heroId === 'xiao') return { type: 'skill', target: id };
        if (p.heroId === 'su' && this.cardValue(cheapest, p) < 10) return { type: 'skill', target: [...targets].sort((a, b) => this.player(a).hp - this.player(b).hp)[0], costId: cheapest.id };
        if (p.heroId === 'lu' && this.cardValue(cheapest, p) <= 6) return { type: 'skill', target: targets[0], costId: cheapest.id };
      }
      const candidates = [];
      for (const c of p.hand) for (const target of this.cardTargets(id, c.id)) {
        const t = this.player(target); let score = 0;
        switch (c.type) {
          case 'heal': score = 16 + (t.hp <= 2 ? 12 : 0); break;
          case 'draw': score = 24; break;
          case 'mend': score = p.hp < p.maxHp ? 30 : 5; break;
          case 'shield': score = 18; break;
          case 'disarm': score = t.armor ? 22 : 8; break;
          case 'rally': score = p.hand.some(x => x.type === 'strike') && p.strikes < this.strikeLimit(id) ? 23 : -1; break;
          case 'arrows': score = 15 + this.enemies(id).length * 2; break;
          case 'fire': score = 15 - t.hp - t.armor * 2; break;
          case 'strike': score = 14 - t.hp - t.armor * 2; break;
          case 'steal': score = 16; break;
          case 'duel': score = p.hand.filter(x => x.type === 'strike').length >= 1 || t.hand.length === 0 ? 9 - t.hp : -1; break;
        }
        if (score > 0) candidates.push({ type: 'play', cardId: c.id, target, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0] || { type: 'end' };
    }
    aiStep() { const action = this.chooseAI(); if (!action) return; const id = this.state.turn; if (action.type === 'play') return this.play(id, action.cardId, action.target); if (action.type === 'skill') return this.useSkill(id, action.target, action.costId); if (action.type === 'discard') return this.discardCard(id, action.cardId); return this.endTurn(id); }
  }
  return { VERSION, HEROES, CARDS, getHero, Game };
});
