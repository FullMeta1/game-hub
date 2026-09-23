import { getHero } from './data.mjs';

export const skillActions = {
  skillError(id, costId) {
    const p = this.player(id), h = getHero(p?.heroId);
    if (this.state.phase !== 'play' || this.state.turn !== id || !p?.alive) return 'It is not your play phase';
    if (h.type !== 'active') return 'This passive skill activates automatically';
    if (p.usedSkill) return 'You already used your skill this turn';
    if (!this.targetsFor(id, h.target).length) return 'No valid skill targets';
    if (h.cost && !p.hand.some(c => c.id === costId)) return 'Choose a card to discard for this skill';
    return '';
  },
  skillTargets(id, costId) { return this.skillError(id, costId) ? [] : this.targetsFor(id, getHero(this.player(id).heroId).target); },
  useSkill(id, targetId, costId) {
    const error = this.skillError(id, costId); if (error) return { ok: false, error };
    const p = this.player(id), h = getHero(p.heroId), target = targetId ?? id;
    if (!this.skillTargets(id, costId).includes(target)) return { ok: false, error: 'Choose a valid skill target' };
    p.usedSkill = true;
    if (h.cost) this.consume(id, costId);
    this.log(`${this.name(id)} used ${h.skill}.`, 'skill');
    if (p.heroId === 'xiao') this.draw(id, 1);
    if (p.heroId === 'su') this.heal(target, 1);
    if (p.heroId === 'lu') this.takeRandom(target, id);
    return { ok: true };
  }
};
