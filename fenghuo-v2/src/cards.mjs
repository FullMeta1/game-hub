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
    if (s.phase !== 'play' || s.turn !== id || !p?.alive) return 'It is not your play phase';
    if (!c) return 'That card is not in your hand';
    if (c.type === 'dodge') return 'Dodge is played automatically when attacked';
    if (c.type === 'strike' && p.strikes >= this.strikeLimit(id)) return 'No Strikes remaining this turn';
    if (c.type === 'shield' && p.armor >= 2) return 'Your armor is already full';
    if (c.type === 'rally' && p.boosted) return 'Battle Order is active; play a Strike first';
    if (!this.targetsFor(id, CARDS[c.type].target).length) return 'No valid targets';
    return '';
  },
  cardTargets(id, cardId) { const c = this.player(id)?.hand.find(c => c.id === cardId); return c && !this.cardError(id, cardId) ? this.targetsFor(id, CARDS[c.type].target) : []; },
  heal(id, amount) { const p = this.player(id); if (!p.alive) return; const gain = Math.min(amount, p.maxHp - p.hp); p.hp += gain; if (gain) this.log(`${this.name(id)} recovered ${gain} HP.`, 'heal'); },
  damage(source, target, amount, evadable = false, ignoreArmor = false) {
    const p = this.player(target); if (!p.alive || this.state.phase === 'over') return;
    if (evadable && this.consumeType(target, 'dodge')) { this.log(`${this.name(target)} played Dodge and avoided the attack.`, 'defend'); return; }
    const absorbed = ignoreArmor ? 0 : Math.min(p.armor, amount);
    p.armor -= absorbed; amount -= absorbed;
    if (absorbed) this.log(`${this.name(target)}'s armor absorbed ${absorbed} damage.`, 'defend');
    if (!amount) return;
    p.hp -= amount;
    if (source === 0) this.state.stats.damage += amount;
    this.log(`${this.name(target)} took ${amount} damage.`, 'damage');
    while (p.hp <= 0 && this.consumeType(target, 'heal')) { p.hp++; this.log(`${this.name(target)} used Field Medic to survive.`, 'heal'); }
    if (p.hp <= 0) {
      p.hp = 0; p.alive = false; p.armor = 0;
      this.state.discard.push(...p.hand.splice(0));
      this.log(`${this.name(target)} was defeated.`, 'damage');
      this.checkWinner();
    }
  },
  takeRandom(from, to) { const p = this.player(from); if (!p.hand.length) return; const [c] = p.hand.splice(Math.floor(this.random() * p.hand.length), 1); if (to === null) this.state.discard.push(c); else this.player(to).hand.push(c); },
  play(id, cardId, targetId) {
    const error = this.cardError(id, cardId); if (error) return { ok: false, error };
    const p = this.player(id), c = p.hand.find(c => c.id === cardId), meta = CARDS[c.type];
    const target = targetId ?? (meta.target === 'self' ? id : null);
    if (!this.cardTargets(id, cardId).includes(target)) return { ok: false, error: 'Choose a highlighted valid target' };
    this.consume(id, cardId);
    if (id === 0) this.state.stats.cards++;
    this.log(`${this.name(id)} played ${meta.name}${target !== id ? ` on ${this.name(target)}` : ''}.`, 'play');
    switch (c.type) {
      case 'strike': { p.strikes++; const amount = p.boosted ? 2 : 1; p.boosted = false; this.damage(id, target, amount, true); break; }
      case 'heal': this.heal(target, 1); break;
      case 'draw': this.draw(id, 2); break;
      case 'fire': this.damage(id, target, 1); break;
      case 'duel': { let responder = target, other = id; while (this.consumeType(responder, 'strike')) { this.log(`${this.name(responder)} answered with Strike.`); [responder, other] = [other, responder]; } this.damage(other, responder, 1); break; }
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
