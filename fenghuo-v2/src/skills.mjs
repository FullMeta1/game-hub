import { getHero } from './data.mjs';

export const skillActions = {
  skillError(id, costId) {
    const p = this.player(id), h = getHero(p?.heroId);
    if (this.state.phase !== 'play' || this.state.turn !== id || !p?.alive) return '现在不是你的出牌阶段';
    if (h.type !== 'active') return '这是自动生效的被动技能';
    if (p.usedSkill) return '本回合技能已用过';
    if (!this.targetsFor(id, h.target).length) return '没有可用的技能目标';
    if (h.cost && !p.hand.some(c => c.id === costId)) return '先选择一张手牌作为技能代价';
    return '';
  },
  skillTargets(id, costId) { return this.skillError(id, costId) ? [] : this.targetsFor(id, getHero(this.player(id).heroId).target); },
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
};
