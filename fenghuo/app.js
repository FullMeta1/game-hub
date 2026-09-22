/* UI only: all rules live in engine.js and are shared with the tests. */
'use strict';
const { Game, HEROES, CARDS, getHero } = Fenghuo;
const $ = id => document.getElementById(id);
const SAVE = 'fenghuo.match.v1', STATS = 'fenghuo.record.v1', PREFS = 'fenghuo.preferences.v1';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const shortText = { strike:'每回合限一次', dodge:'自动应对', heal:'恢复一点体力', draw:'摸两张牌', fire:'无法闪避', duel:'轮流打出破阵', steal:'夺取一张手牌', disarm:'破甲并弃牌', arrows:'攻击全部敌将', shield:'补至两层护甲', rally:'下次破阵增强', mend:'回血并摸一张牌' };
let game = null, selectedHero = 'xiao', selectedCard = null, selectedTarget = null, skillMode = false;
let aiTimer = null, toastTimer = null, resultShown = false, storageWarning = false, audioContext = null;
let preferences = read(PREFS, { sound: false, fast: false });
let record = read(STATS, { played: 0, won: 0 });
if (!Number.isInteger(record.played) || !Number.isInteger(record.won)) record = { played: 0, won: 0 };
let saved = read(SAVE, null);
if (saved) { try { saved = Game.restore(saved).state; } catch { saved = null; } }

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { if (!storageWarning) { storageWarning = true; toast('浏览器不允许存档，本局仍可正常游玩。'); } } }
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
  $('hero-grid').innerHTML = HEROES.map(h => `<button class="hero-option ${h.color}" data-hero="${h.id}" aria-pressed="${selectedHero === h.id}" aria-label="${h.name}，${h.hp} 点体力，${h.skill}：${h.desc}"><span class="hero-mark" aria-hidden="true">${h.mark}</span><span class="hero-title">${h.title}</span><span class="hero-name">${h.name}</span><span><span class="hero-skill">${h.skill}</span><span class="hp-label">${h.hp} 点体力</span></span><span class="hero-desc">${h.desc}</span></button>`).join('');
  $('start').innerHTML = `以${getHero(selectedHero).name}出战 <span aria-hidden="true">↗</span>`;
  $('record').textContent = record.played ? `已完成 ${record.played} 局 · 胜 ${record.won} 局` : '首战在即 · 选一位武将开启对局';
  $('resume').hidden = !saved || saved.phase === 'over';
  $('new-game').hidden = true;
}
$('hero-grid').addEventListener('click', e => { const button = e.target.closest('[data-hero]'); if (!button) return; selectedHero = button.dataset.hero; renderLobby(); });
function launch() {
  game = new Game(selectedHero); resultShown = false; clearSelection(); closeModal();
  $('lobby').hidden = true; $('battle').hidden = false; $('new-game').hidden = false; render(); window.scrollTo({ top: 0, behavior: 'instant' });
  toast('先选牌，再点高亮武将；锦囊与技能也能改变局势。');
}
$('start').addEventListener('click', () => {
  if (saved && saved.phase !== 'over') {
    showModal('重新点将', '<h2>开启新的一局？</h2><p>当前未完成的对局会被新局替换。</p><div class="dialog-actions"><button class="button secondary" id="keep-save">保留旧局</button><button class="button primary" id="replace-save">开始新局</button></div>');
    $('keep-save').onclick = closeModal; $('replace-save').onclick = launch;
  } else launch();
});
$('resume').addEventListener('click', () => {
  try { game = Game.restore(saved); } catch { toast('此存档无法读取，请开始新局。'); return; }
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
  const role = p.id === 0 ? '你' : p.team === 0 ? '友军' : '敌军';
  return `<button class="fighter ${h.color} ${current ? 'current' : ''} ${!p.alive ? 'dead' : ''} ${targetable ? 'targetable' : ''} ${selectedTarget === p.id ? 'targeted' : ''}" data-player="${p.id}" aria-label="${h.name}，${role}，体力 ${p.hp}/${p.maxHp}，护甲 ${p.armor}，${p.hand.length} 张手牌${targetable ? '，可选目标' : ''}" aria-pressed="${selectedTarget === p.id}"><span class="portrait" aria-hidden="true">${h.mark}</span><span><span class="fighter-name">${h.name}<span class="faction ${p.team ? 'enemy' : ''}">${p.alive ? role : '退场'}</span></span><span class="health" aria-hidden="true">${Array.from({ length:p.maxHp }, (_, i) => `<i class="health-pip ${i < p.hp ? 'full' : ''}"></i>`).join('')}<span class="health-number">${p.hp}/${p.maxHp}</span></span><span class="fighter-meta"><span>手牌 ${p.hand.length}</span><span>甲 ${p.armor}</span></span></span><span class="fighter-info"><b>${h.skill}</b>${h.type === 'passive' ? '被动' : p.usedSkill && current ? '已使用' : '主动'}${p.boosted ? ' · 军令生效' : ''}${current ? ' · 行动中' : ''}</span></button>`;
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
  $('round-text').textContent = `第 ${s.round} 轮`;
  $('deck-text').textContent = `牌堆 ${s.deck.length} · 弃牌 ${s.discard.length}`;
  $('opponents').innerHTML = [game.player(1), game.player(3)].map(p => fighter(p, targets)).join('');
  $('allies').innerHTML = [game.player(0), game.player(2)].map(p => fighter(p, targets)).join('');
  $('turn-pill').textContent = s.phase === 'over' ? `${s.winner === 0 ? '青锋' : '赤霄'}获胜 · 对局结束` : myTurn ? (s.phase === 'discard' ? `弃牌阶段 · 请弃 ${p.hand.length - game.handLimit(0)} 张` : '你的回合 · 出牌阶段') : `${game.name(s.turn)}正在${s.phase === 'discard' ? '弃牌' : '行动'}`;
  $('table-hint').textContent = s.phase === 'over' ? '可在战报中回看这一局' : targets.length && selectedTarget === null ? '点击高亮的武将，再确认出牌' : !p.alive ? '你已退场，友军仍在战斗' : s.round >= 20 ? '鏖战生效：每位武将回合开始失去 1 点体力' : myTurn ? `破阵 ${p.strikes}/${game.strikeLimit(0)} · 击败两名敌将即可获胜` : '闪避与濒死自救将自动处理';
  $('hand-count').textContent = `${p.hand.length} 张`;
  $('hand-hint').textContent = s.phase === 'discard' && myTurn ? `选择要弃的牌，保留至 ${game.handLimit(0)} 张` : '点击卡牌查看效果，横向滑动查看更多';
  $('hand').innerHTML = p.hand.length ? p.hand.map(c => {
    const m = CARDS[c.type], unavailable = myTurn && s.phase === 'play' && !skillMode && game.cardError(0, c.id);
    return `<button class="card ${m.color} ${selectedCard === c.id ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}" data-card="${c.id}" aria-pressed="${selectedCard === c.id}" aria-label="${m.name}：${m.text}"><span class="card-top"><span>${m.kind}</span><span>${String(c.id % 13 + 1).padStart(2, '0')}</span></span><span class="card-glyph" aria-hidden="true">${m.glyph}</span><span class="card-name">${m.name}</span><span class="card-short">${shortText[c.type]}</span></button>`;
  }).join('') : `<div class="empty-hand">${p.alive ? '暂时没有手牌，可以结束回合。' : '武将已退场，正在观战。'}</div>`;
  $('end-turn').disabled = !myTurn || s.phase !== 'play';
  $('end-turn').textContent = s.phase === 'discard' && myTurn ? '请先弃牌' : '结束回合';
  $('cancel').hidden = selectedCard === null && !skillMode;
  $('skill').textContent = h.type === 'passive' ? `${h.skill} · 被动` : `${h.skill}${p.usedSkill && myTurn ? ' · 已用' : ''}`;
  $('skill').disabled = h.type === 'active' && (!myTurn || s.phase !== 'play' || p.usedSkill);
  $('skill').setAttribute('aria-pressed', String(skillMode));
  let detail = '请选择一张牌；闪避与濒死自救会自动处理。', label = '选择手牌', enabled = false;
  if (s.phase === 'over') { detail = '本局已结束。点击「换将」可以开始新局。'; label = '对局结束'; }
  else if (skillMode) {
    detail = `<strong>${h.skill}</strong> · ${h.desc}`;
    const error = game.skillError(0, selectedCard);
    label = error && h.cost && selectedCard === null ? '先选弃牌' : selectedTarget === null ? '选择目标' : `发动${h.skill}`;
    enabled = !error && selectedTarget !== null;
    if (h.cost && card) detail += ` <strong>弃置：${meta.name}</strong>`;
  } else if (card) {
    detail = `<strong>${meta.name}</strong> · ${meta.text}`;
    if (myTurn && s.phase === 'discard') { label = '弃置此牌'; enabled = true; }
    else if (myTurn) { const error = game.cardError(0, selectedCard); label = error ? (card.type === 'dodge' ? '自动应对' : '暂不可用') : selectedTarget === null ? '选择目标' : '确认出牌'; enabled = !error && selectedTarget !== null; if (error) detail += ` <span class="muted">${error}。</span>`; }
    else label = '等待回合';
  } else if (!myTurn) { label = p.alive ? '等待回合' : '观战中'; detail = p.alive ? '其他武将正在行动。你可以查看手牌效果。' : '你已退场；只要友军击败敌方，仍算胜利。'; }
  $('selection-detail').innerHTML = detail;
  $('play').textContent = label; $('play').disabled = !enabled;
  const log = $('log'); log.innerHTML = s.log.slice(-45).map(l => `<li class="${esc(l.type)}">${esc(l.text)}</li>`).join(''); log.scrollTop = log.scrollHeight;
  $('last-event').textContent = s.log.at(-1)?.text || '';
  if (s.phase === 'over' && !s.recorded) { record.played++; if (s.winner === 0) record.won++; s.recorded = true; write(STATS, record); }
  save();
  if (s.phase === 'over' && !resultShown) { resultShown = true; showResult(); }
  scheduleAI();
}
$('hand').addEventListener('click', e => { const el = e.target.closest('[data-card]'); if (!el) return; const id = Number(el.dataset.card); selectedCard = selectedCard === id ? null : id; selectedTarget = null; render(); });
document.querySelector('.table').addEventListener('click', e => {
  const el = e.target.closest('[data-player]'); if (!el) return;
  const id = Number(el.dataset.player);
  if (validTargets().includes(id)) { selectedTarget = id; render(); }
  else if (selectedCard !== null || skillMode) toast('这名武将不是当前牌或技能的有效目标。');
  else { const p = game.player(id), h = getHero(p.heroId); toast(`${h.name} · ${h.skill}：${h.desc}`); }
});
$('play').addEventListener('click', () => {
  if (!isMyTurn()) return;
  const result = game.state.phase === 'discard' ? game.discardCard(0, selectedCard) : skillMode ? game.useSkill(0, selectedTarget, selectedCard) : game.play(0, selectedCard, selectedTarget);
  if (!result?.ok) { toast(result?.error || '请先选择手牌'); return; }
  tone(); clearSelection(); render();
});
$('cancel').addEventListener('click', () => { clearSelection(); render(); });
$('skill').addEventListener('click', () => {
  const h = getHero(game.player(0).heroId);
  if (h.type === 'passive') { toast(`${h.skill}：${h.desc}`); return; }
  skillMode = !skillMode; selectedTarget = null; render();
});
$('end-turn').addEventListener('click', () => { const result = game.endTurn(0); if (!result.ok) toast(result.error); clearSelection(); render(); });
function updatePreferences() { $('sound').textContent = `音效：${preferences.sound ? '开' : '关'}`; $('sound').setAttribute('aria-pressed', String(preferences.sound)); $('speed').textContent = `速度 ×${preferences.fast ? '3' : '1'}`; write(PREFS, preferences); }
$('sound').addEventListener('click', () => { preferences.sound = !preferences.sound; updatePreferences(); tone(); });
$('speed').addEventListener('click', () => { preferences.fast = !preferences.fast; updatePreferences(); scheduleAI(); });
$('show-log').addEventListener('click', () => showModal('对局记录', `<h2>战报</h2><ol class="modal-logs">${game.state.log.slice(-50).reverse().map(l => `<li><span class="muted">第 ${l.round} 轮 · </span>${esc(l.text)}</li>`).join('')}</ol>`));
function showResult() {
  const s = game.state, won = s.winner === 0;
  if (won) tone('win');
  showModal('终局', `<div class="result"><div class="result-mark">${won ? '胜' : '败'}</div><h2>${won ? '青锋得胜' : '此局惜败'}</h2><p>${won ? '此战已定，下一局再论谋略。' : '留足防御，配合友军，再试一局。'}</p><div class="result-stats"><div><strong>${s.round}</strong><span>对局轮数</span></div><div><strong>${s.stats.cards}</strong><span>你的出牌</span></div><div><strong>${s.stats.damage}</strong><span>你的伤害</span></div></div></div><div class="dialog-actions"><button id="review" class="button secondary">回看战场</button><button id="again" class="button primary">重新点将</button></div>`);
  $('review').onclick = closeModal; $('again').onclick = goLobby;
}
$('rules').addEventListener('click', () => showModal('玩法指南', `<h2>三分钟入局</h2><p>这是原创阵营卡牌游戏，不是官方三国杀。你与一名 AI 友军组成青锋军，对抗两名赤霄敌将；所有阵营公开。</p><h3>一轮怎么打</h3><ol><li>按你 → 敌将 → 友军 → 敌将的顺序行动。每回合摸 2 张牌，武将技能可能改变数量。</li><li>点击一张手牌，点高亮目标，再点「确认出牌」。无需目标的牌会自动选中自己。</li><li>每回合通常可用一次「破阵」；其他主动卡牌不限次数。主动技能每回合一次，部分技能需先选一张牌作为代价。</li><li>点「结束回合」后，将手牌弃至当前体力值（至少保留 1 张）。点牌再点「弃置此牌」。</li></ol><h3>防御与胜负</h3><ul><li>「闪避」自动抵消破阵或箭雨；护甲每层再抵消 1 点伤害。</li><li>体力降至零时，自动消耗自己手中的「军医」自救；不足则退场。</li><li>对决时双方自动轮流消耗「破阵」，不占出牌阶段次数；先无法应战者受伤。</li><li>你的武将退场后可以观战，只要队友获胜仍算赢。</li><li>第 20 轮起进入鏖战，每位武将回合开始失去 1 点体力，无视护甲，可用军医自救。</li><li>对局自动保存在当前浏览器；换设备不会同步。查看玩法时 AI 暂停。</li></ul><h3>卡牌图鉴</h3>${Object.values(CARDS).map(c => `<div class="rule-card"><b>${c.name}</b><span>${c.text}</span></div>`).join('')}`));
$('install-help').addEventListener('click', () => showModal('随时开局', '<h2>放到手机桌面</h2><p><strong>iPhone / iPad：</strong>用 Safari 打开游戏网址，点「分享」，选择「添加到主屏幕」。</p><p><strong>安卓：</strong>用 Chrome 打开游戏，点右上角菜单，再选「添加到主屏幕」或「安装应用」。</p><p>先联网打开游戏一次，缓存完成后即可离线玩。存档保存在当前浏览器，桌面版和浏览器可能使用独立存储；清除网站数据会删除记录。</p><p>需要从 HTTPS 网页打开；直接在文件预览里打开 HTML 不支持安装。</p>'));
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAI(); save(); } else scheduleAI(); });
window.addEventListener('pagehide', save);
window.addEventListener('offline', () => toast('当前离线，已缓存的游戏仍可继续。'));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').open && game && !$('battle').hidden) { clearSelection(); render(); } });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => { /* Offline support is optional when hosting forbids workers. */ });
renderLobby(); updatePreferences();
