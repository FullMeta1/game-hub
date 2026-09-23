/* UI only: all rules live in the modules imported by Game. */
'use strict';
import { Game, HEROES, CARDS, getHero } from './game.mjs';
import { storage } from './storage.mjs';
const $ = id => document.getElementById(id);
const SAVE = 'match', STATS = 'record', PREFS = 'preferences';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const shortText = { strike:'Once per turn', dodge:'Auto-block', heal:'Restore 1 HP', draw:'Draw 2 cards', fire:'No Dodge', duel:'Trade Strikes', steal:'Steal a card', disarm:'Break armor', arrows:'Hit all enemies', shield:'Gain 2 armor', rally:'Boost a Strike', mend:'Heal and draw' };
let game = null, selectedHero = 'xiao', selectedCard = null, selectedTarget = null, skillMode = false;
let aiTimer = null, toastTimer = null, resultShown = false, storageWarning = false, audioContext = null;
let preferences = read(PREFS, { sound: false, fast: true });
let record = read(STATS, { played: 0, won: 0 });
if (!Number.isInteger(record.played) || !Number.isInteger(record.won)) record = { played: 0, won: 0 };
let saved = read(SAVE, null);
if (saved) { try { saved = Game.restore(saved).state; } catch { saved = null; } }

function read(key, fallback) { return storage.read(key, fallback); }
function write(key, value) { if (!storage.write(key, value) && !storageWarning) { storageWarning = true; toast('Browser storage is unavailable. You can still finish this game.'); } }
function save() { if (game) { saved = JSON.parse(JSON.stringify(game.state)); write(SAVE, saved); } }
function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('visible'); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
function tone(kind = 'card') {
  if (!preferences.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(kind === 'win' ? 660 : 380, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(kind === 'win' ? 880 : 240, audioContext.currentTime + .1);
    gain.gain.setValueAtTime(.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .18);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .2);
  } catch { /* Audio is optional, never a condition for playing. */ }
}
function stopAI() { clearTimeout(aiTimer); aiTimer = null; }
function scheduleAI() {
  stopAI();
  if (!game || $('battle').hidden || document.hidden || $('modal').open || game.state.phase === 'over' || game.state.turn === 0) return;
  aiTimer = setTimeout(() => { game.aiStep(); selectedTarget = null; render(); }, preferences.fast ? 260 : 750);
}
function showModal(title, content) {
  stopAI(); $('modal-eyebrow').textContent = title; $('modal-content').innerHTML = content;
  if (!$('modal').open) $('modal').showModal();
}
function closeModal() { $('modal').close(); }
$('close-modal').addEventListener('click', closeModal);
$('modal').addEventListener('close', scheduleAI);
$('modal').addEventListener('click', e => { if (e.target === $('modal')) { const r = $('modal').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(); } });

function renderLobby() {
  $('hero-grid').innerHTML = HEROES.map(h => `<button class="hero-option ${h.color}" data-hero="${h.id}" aria-pressed="${selectedHero === h.id}" aria-label="${h.name}, ${h.hp} HP, ${h.skill}: ${h.desc}"><span class="hero-mark" aria-hidden="true">${h.mark}</span><span class="hero-title">${h.title}</span><span class="hero-name">${h.name}</span><span><span class="hero-skill">${h.skill}</span><span class="hp-label">${h.hp} HP</span></span><span class="hero-desc">${h.desc}</span></button>`).join('');
  $('start').innerHTML = `Play as ${getHero(selectedHero).name} <span aria-hidden="true">↗</span>`;
  $('record').textContent = record.played ? `${record.played} completed · ${record.won} won` : 'Select a commander to begin your first match';
  $('resume').hidden = !saved || saved.phase === 'over';
  $('new-game').hidden = true;
}
$('hero-grid').addEventListener('click', e => { const button = e.target.closest('[data-hero]'); if (!button) return; selectedHero = button.dataset.hero; renderLobby(); });
function launch() {
  game = new Game(selectedHero); resultShown = false; clearSelection(); closeModal();
  $('lobby').hidden = true; $('battle').hidden = false; $('new-game').hidden = false; render(); window.scrollTo({ top: 0, behavior: 'instant' });
  toast('Pick a card, choose a highlighted target, then confirm.');
}
$('start').addEventListener('click', () => {
  if (saved && saved.phase !== 'over') {
    showModal('New match', '<h2>Replace your saved match?</h2><p>Your unfinished match will be replaced only if you start a new one.</p><div class="dialog-actions"><button class="button secondary" id="keep-save">Keep saved match</button><button class="button primary" id="replace-save">Start new match</button></div>');
    $('keep-save').onclick = closeModal; $('replace-save').onclick = launch;
  } else launch();
});
$('resume').addEventListener('click', () => {
  try { game = Game.restore(saved); } catch { toast('Could not open this save. Start a new match.'); return; }
  resultShown = false; clearSelection(); $('lobby').hidden = true; $('battle').hidden = false; $('new-game').hidden = false; render();
});
function goLobby() { stopAI(); save(); $('battle').hidden = true; $('lobby').hidden = false; closeModal(); renderLobby(); }
$('new-game').addEventListener('click', goLobby);
function clearSelection() { selectedCard = null; selectedTarget = null; skillMode = false; }
function isMyTurn() { return game && game.state.turn === 0 && game.state.phase !== 'over'; }
function validTargets() {
  if (!isMyTurn() || game.state.phase === 'discard') return [];
  return skillMode ? game.skillTargets(0, selectedCard) : game.cardTargets(0, selectedCard);
}
function fighter(p, targets) {
  const h = getHero(p.heroId), s = game.state, targetable = targets.includes(p.id), current = s.turn === p.id && s.phase !== 'over';
  const role = p.id === 0 ? 'You' : p.team === 0 ? 'Ally' : 'Enemy';
  return `<button class="fighter ${h.color} ${current ? 'current' : ''} ${!p.alive ? 'dead' : ''} ${targetable ? 'targetable' : ''} ${selectedTarget === p.id ? 'targeted' : ''}" data-player="${p.id}" aria-label="${h.name}, ${role}, ${p.hp} of ${p.maxHp} HP, ${p.armor} armor, ${p.hand.length} cards${targetable ? ', valid target' : ''}" aria-pressed="${selectedTarget === p.id}"><span class="portrait" aria-hidden="true">${h.mark}</span><span><span class="fighter-name">${h.name}<span class="faction ${p.team ? 'enemy' : ''}">${p.alive ? role : 'Out'}</span></span><span class="health" aria-hidden="true">${Array.from({ length:p.maxHp }, (_, i) => `<i class="health-pip ${i < p.hp ? 'full' : ''}"></i>`).join('')}<span class="health-number">${p.hp}/${p.maxHp}</span></span><span class="fighter-meta"><span>Cards ${p.hand.length}</span><span>Armor ${p.armor}</span></span></span><span class="fighter-info"><b>${h.skill}</b>${h.type === 'passive' ? 'Passive' : p.usedSkill && current ? 'Used' : 'Active'}${p.boosted ? ' · Boosted' : ''}${current ? ' · Acting' : ''}</span></button>`;
}
function render() {
  if (!game) return;
  const s = game.state, p = game.player(0), h = getHero(p.heroId), myTurn = isMyTurn();
  if (!p.hand.some(c => c.id === selectedCard)) selectedCard = null;
  if (!myTurn) skillMode = false;
  const targets = validTargets();
  if (!targets.includes(selectedTarget)) selectedTarget = null;
  const card = p.hand.find(c => c.id === selectedCard), meta = card ? CARDS[card.type] : null;
  if ((skillMode ? h.target === 'self' : meta?.target === 'self') && targets.includes(0)) selectedTarget = 0;
  $('round-text').textContent = `Round ${s.round}`;
  $('deck-text').textContent = `Deck ${s.deck.length} · Discard ${s.discard.length}`;
  $('opponents').innerHTML = [game.player(1), game.player(3)].map(p => fighter(p, targets)).join('');
  $('allies').innerHTML = [game.player(0), game.player(2)].map(p => fighter(p, targets)).join('');
  $('turn-pill').textContent = s.phase === 'over' ? `${s.winner === 0 ? 'Azure' : 'Crimson'} wins · Match over` : myTurn ? (s.phase === 'discard' ? `Discard ${p.hand.length - game.handLimit(0)} ${p.hand.length - game.handLimit(0) === 1 ? 'card' : 'cards'}` : 'Your turn · Play phase') : `${game.name(s.turn)} is ${s.phase === 'discard' ? 'discarding' : 'playing'}`;
  $('table-hint').textContent = s.phase === 'over' ? 'Review this match in the battle log' : targets.length && selectedTarget === null ? 'Tap a highlighted commander, then confirm' : !p.alive ? 'You are out; your ally is still fighting' : s.round >= 20 ? 'Fatigue: each commander loses 1 HP at the start of their turn' : myTurn ? `Strikes ${p.strikes}/${game.strikeLimit(0)} · Defeat both enemies to win` : 'Dodge and last-chance healing resolve automatically';
  $('hand-count').textContent = `${p.hand.length} ${p.hand.length === 1 ? 'card' : 'cards'}`;
  $('hand-hint').textContent = s.phase === 'discard' && myTurn ? `Choose cards to discard until you have ${game.handLimit(0)} left` : 'Tap a card to see its effect; swipe sideways for more';
  $('hand').innerHTML = p.hand.length ? p.hand.map(c => {
    const m = CARDS[c.type], unavailable = myTurn && s.phase === 'play' && !skillMode && game.cardError(0, c.id);
    return `<button class="card ${m.color} ${selectedCard === c.id ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}" data-card="${c.id}" aria-pressed="${selectedCard === c.id}" aria-label="${m.name}：${m.text}"><span class="card-top"><span>${m.kind}</span><span>${String(c.id % 13 + 1).padStart(2, '0')}</span></span><span class="card-glyph" aria-hidden="true">${m.glyph}</span><span class="card-name">${m.name}</span><span class="card-short">${shortText[c.type]}</span></button>`;
  }).join('') : `<div class="empty-hand">${p.alive ? 'No cards in hand. You can end your turn.' : 'Your commander is out. Watch your ally finish the match.'}</div>`;
  $('end-turn').disabled = !myTurn || s.phase !== 'play';
  $('end-turn').textContent = s.phase === 'discard' && myTurn ? 'Discard first' : 'End turn';
  $('cancel').hidden = selectedCard === null && !skillMode;
  $('skill').textContent = h.type === 'passive' ? `${h.skill} · Passive` : `${h.skill}${p.usedSkill && myTurn ? ' · Used' : ''}`;
  $('skill').disabled = h.type === 'active' && (!myTurn || s.phase !== 'play' || p.usedSkill);
  $('skill').setAttribute('aria-pressed', String(skillMode));
  let detail = 'Choose a card. Dodge and last-chance healing happen automatically.', label = 'Choose a card', enabled = false;
  if (s.phase === 'over') { detail = 'Match over. Choose Commanders to play again.'; label = 'Match over'; }
  else if (skillMode) {
    detail = `<strong>${h.skill}</strong> · ${h.desc}`;
    const error = game.skillError(0, selectedCard);
    label = error && h.cost && selectedCard === null ? 'Choose a cost card' : selectedTarget === null ? 'Choose a target' : `Use ${h.skill}`;
    enabled = !error && selectedTarget !== null;
    if (h.cost && card) detail += ` <strong>Discard: ${meta.name}</strong>`;
  } else if (card) {
    detail = `<strong>${meta.name}</strong> · ${meta.text}`;
    if (myTurn && s.phase === 'discard') { label = 'Discard this card'; enabled = true; }
    else if (myTurn) { const error = game.cardError(0, selectedCard); label = error ? (card.type === 'dodge' ? 'Auto-response' : 'Unavailable') : selectedTarget === null ? 'Choose a target' : 'Play card'; enabled = !error && selectedTarget !== null; if (error) detail += ` <span class="muted">${error}.</span>`; }
    else label = 'Wait for turn';
  } else if (!myTurn) { label = p.alive ? 'Wait for turn' : 'Spectating'; detail = p.alive ? 'Other commanders are acting. You can inspect your cards.' : 'You are out. Your ally can still win the match.'; }
  $('selection-detail').innerHTML = detail;
  $('play').textContent = label; $('play').disabled = !enabled;
  const log = $('log'); log.innerHTML = s.log.slice(-45).map(l => `<li class="${esc(l.type)}">${esc(l.text)}</li>`).join(''); log.scrollTop = log.scrollHeight;
  $('last-event').textContent = s.log.at(-1)?.text || '';
  if (s.phase === 'over' && !s.recorded) { record.played++; if (s.winner === 0) record.won++; s.recorded = true; write(STATS, record); }
  save();
  if (s.phase === 'over' && !resultShown) { resultShown = true; showResult(); }
  scheduleAI();
}
$('hand').addEventListener('click', e => {
  const el = e.target.closest('[data-card]'); if (!el) return;
  const id = Number(el.dataset.card); selectedCard = selectedCard === id ? null : id; selectedTarget = null; render();
  if (selectedCard !== null && isMyTurn() && game.state.phase === 'play' && validTargets().some(target => target !== 0) && window.matchMedia?.('(max-width: 800px)').matches) {
    document.querySelector('.table').scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  }
});
document.querySelector('.table').addEventListener('click', e => {
  const el = e.target.closest('[data-player]'); if (!el) return;
  const id = Number(el.dataset.player);
  if (validTargets().includes(id)) { selectedTarget = id; render(); }
  else if (selectedCard !== null || skillMode) toast('That commander is not a valid target.');
  else { const p = game.player(id), h = getHero(p.heroId); toast(`${h.name} · ${h.skill}: ${h.desc}`); }
});
$('play').addEventListener('click', () => {
  if (!isMyTurn()) return;
  const result = game.state.phase === 'discard' ? game.discardCard(0, selectedCard) : skillMode ? game.useSkill(0, selectedTarget, selectedCard) : game.play(0, selectedCard, selectedTarget);
  if (!result?.ok) { toast(result?.error || 'Choose a card first'); return; }
  tone(); clearSelection(); render();
});
$('cancel').addEventListener('click', () => { clearSelection(); render(); });
$('skill').addEventListener('click', () => {
  const h = getHero(game.player(0).heroId);
  if (h.type === 'passive') { toast(`${h.skill}：${h.desc}`); return; }
  skillMode = !skillMode; selectedTarget = null; render();
});
$('end-turn').addEventListener('click', () => { const result = game.endTurn(0); if (!result.ok) toast(result.error); clearSelection(); render(); });
function updatePreferences() { $('sound').textContent = `Sound ${preferences.sound ? 'on' : 'off'}`; $('sound').setAttribute('aria-pressed', String(preferences.sound)); $('speed').textContent = `Speed ×${preferences.fast ? '3' : '1'}`; write(PREFS, preferences); }
$('sound').addEventListener('click', () => { preferences.sound = !preferences.sound; updatePreferences(); tone(); });
$('speed').addEventListener('click', () => { preferences.fast = !preferences.fast; updatePreferences(); scheduleAI(); });
$('show-log').addEventListener('click', () => showModal('Match history', `<h2>Battle log</h2><ol class="modal-logs">${game.state.log.slice(-50).reverse().map(l => `<li><span class="muted">Round ${l.round} · </span>${esc(l.text)}</li>`).join('')}</ol>`));
function showResult() {
  const s = game.state, won = s.winner === 0;
  if (won) tone('win');
  showModal('Match complete', `<div class="result"><div class="result-mark">${won ? 'W' : 'L'}</div><h2>${won ? 'Azure wins' : 'Crimson wins'}</h2><p>${won ? 'Your team held the field.' : 'Try protecting your ally and keeping a Dodge in hand.'}</p><div class="result-stats"><div><strong>${s.round}</strong><span>Rounds</span></div><div><strong>${s.stats.cards}</strong><span>Cards played</span></div><div><strong>${s.stats.damage}</strong><span>Damage dealt</span></div></div></div><div class="dialog-actions"><button id="review" class="button secondary">Review battlefield</button><button id="again" class="button primary">Choose commanders</button></div>`);
  $('review').onclick = closeModal; $('again').onclick = goLobby;
}
$('rules').addEventListener('click', () => showModal('How to play', `<h2>Learn the round</h2><p>Fenghuo Tactics is an original, unofficial team card game. You and an AI ally play as Azure against two Crimson commanders. Teams are visible.</p><h3>Your turn</h3><ol><li>Turns go in order: you, enemy, ally, enemy. Draw 2 cards at the start of a turn, with some commander abilities adding more.</li><li>Tap a card, tap a highlighted target, then tap Play card. Cards that target yourself select you automatically.</li><li>You can usually play one Strike per turn. Other playable cards have no per-turn limit. Active commander skills are once per turn; some require you to discard a card.</li><li>After End turn, discard down to your current HP, keeping at least 1 card. Tap a card, then Discard this card.</li></ol><h3>Defense and victory</h3><ul><li>Dodge automatically blocks a Strike or Arrow Volley. Armor then absorbs remaining damage.</li><li>At 0 HP, Field Medic cards in your hand are used automatically to save you. If you cannot recover, you leave the match.</li><li>In a Duel, both sides automatically trade Strikes; those responses do not count against the play-phase Strike limit. The first player unable to respond takes damage.</li><li>If your commander is defeated, you may watch your ally. Your team can still win.</li><li>From round 20, fatigue deals 1 damage at the start of each turn, ignoring armor. Field Medic can still save you.</li><li>Your match is saved in this browser only. Opening these rules pauses the AI.</li></ul><h3>Card guide</h3>${Object.values(CARDS).map(c => `<div class="rule-card"><b>${c.name}</b><span>${c.text}</span></div>`).join('')}`));
$('install-help').addEventListener('click', () => showModal('Play anywhere', '<h2>Add to your home screen</h2><p><strong>iPhone or iPad:</strong> Open the game in Safari, tap Share, then Add to Home Screen.</p><p><strong>Android:</strong> Open the game in Chrome, open the menu, then choose Add to Home Screen or Install app.</p><p>Open the game online once to cache its files for offline play. Saves stay in this browser and might be separate from an installed shortcut. Clearing site data removes saves.</p><p>Installation requires the HTTPS game page; opening a downloaded HTML file will not install it.</p>'));
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAI(); save(); } else scheduleAI(); });
window.addEventListener('pagehide', save);
window.addEventListener('offline', () => toast('You are offline. Cached matches can still be played.'));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').open && game && !$('battle').hidden) { clearSelection(); render(); } });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => { /* Offline support is optional when hosting forbids workers. */ });
renderLobby(); updatePreferences();
