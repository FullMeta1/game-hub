import { CARDS } from './data.mjs';

export const cardActions = {
  strikeLimit(id) { return this.player(id).heroId === 'gu' ? 2 : 1; },
  targetsFor(id, target) {
    if (target === 'self') return [id];
    if (target === 'ally') return this.allies(id).filter(p => p.hp < p.maxHp).map(p => p.id);
    if (target === 'enemy') return this.enemies(id).map(p => p.id);
    if (target === 'enemyHand') return this.enemies(id).filter(p => p.hand.length).map(p => p.id);
    if (target === 'enemyResource') return this.enemies(id).filter(p => p.hand.length || p.armor).map(p => p.id);
    return [];
  },
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
  },
  cardTargets(id, cardId) { const c = this.player(id)?.hand.find(c => c.id === cardId); return c && !this.cardError(id, cardId) ? this.targetsFor(id, CARDS[c.type].target) : []; },
  heal(id, amount) { const p = this.player(id); if (!p.alive) return; const gain = Math.min(amount, p.maxHp - p.hp); p.hp += gain; if (gain) this.log(`${this.name(id)}恢复 ${gain} 点体力。`, 'heal'); },
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
  },
  takeRandom(from, to) { const p = this.player(from); if (!p.hand.length) return; const [c] = p.hand.splice(Math.floor(this.random() * p.hand.length), 1); if (to === null) this.state.discard.push(c); else this.player(to).hand.push(c); },
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
};
