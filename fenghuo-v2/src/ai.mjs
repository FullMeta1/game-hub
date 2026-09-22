import { getHero } from './data.mjs';

export const aiActions = {
  cardValue(card, p) {
    const base = { strike: 5, dodge: 7, heal: 8, draw: 9, fire: 7, duel: 4, steal: 5, disarm: 4, arrows: 7, shield: 6, rally: 4, mend: 8 };
    return base[card.type] + ((card.type === 'heal' || card.type === 'mend') && p.hp <= 2 ? 6 : 0) - (card.type === 'strike' && p.strikes >= this.strikeLimit(p.id) ? 3 : 0);
  },
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
  },
  aiStep() { const action = this.chooseAI(); if (!action) return; const id = this.state.turn; if (action.type === 'play') return this.play(id, action.cardId, action.target); if (action.type === 'skill') return this.useSkill(id, action.target, action.costId); if (action.type === 'discard') return this.discardCard(id, action.cardId); return this.endTurn(id); }
};
