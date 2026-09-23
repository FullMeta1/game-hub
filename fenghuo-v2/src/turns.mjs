import { CARDS } from './data.mjs';

export const turnActions = {
  checkWinner() { const teams = new Set(this.state.players.filter(p => p.alive).map(p => p.team)); if (teams.size === 1) { this.state.winner = [...teams][0]; this.state.phase = 'over'; this.log(`${this.state.winner === 0 ? 'Azure' : 'Crimson'} wins!`, 'system'); } },
  beginTurn() {
    const s = this.state, p = this.player(s.turn); if (s.phase === 'over') return;
    s.phase = 'play'; p.strikes = 0; p.usedSkill = false; p.boosted = false;
    this.log(`${this.name(p.id)}'s turn.`, 'turn');
    if (s.round >= 20) { this.log('Fatigue: lose 1 HP at the start of a turn, ignoring armor.', 'system'); this.damage(null, p.id, 1, false, true); if (s.phase === 'over') return; if (!p.alive) { this.advance(); return; } }
    if (p.heroId === 'chu') { p.armor = Math.min(2, p.armor + 1); this.log('Iron Wall granted 1 armor.', 'skill'); }
    this.draw(p.id, p.heroId === 'shen' ? 3 : 2);
  },
  handLimit(id) { return Math.max(1, this.player(id).hp); },
  endTurn(id) {
    if (this.state.turn !== id || this.state.phase !== 'play') return { ok: false, error: 'You cannot end this phase' };
    const p = this.player(id); p.boosted = false;
    if (p.hand.length > this.handLimit(id)) { this.state.phase = 'discard'; this.log(`${this.name(id)} must discard down to the hand limit.`, 'turn'); return { ok: true }; }
    this.advance(); return { ok: true };
  },
  discardCard(id, cardId) {
    if (this.state.turn !== id || this.state.phase !== 'discard' || !this.player(id).hand.some(c => c.id === cardId)) return { ok: false, error: 'You cannot discard that card' };
    const c = this.consume(id, cardId); this.log(`${this.name(id)} discarded ${CARDS[c.type].name}.`);
    if (this.player(id).hand.length <= this.handLimit(id)) this.advance();
    return { ok: true };
  },
  advance() {
    if (this.state.phase === 'over') return;
    for (let i = 0; i < 4; i++) { this.state.turn = (this.state.turn + 1) % 4; if (this.state.turn === 0) this.state.round++; if (this.player(this.state.turn).alive) break; }
    this.beginTurn();
  }
};
