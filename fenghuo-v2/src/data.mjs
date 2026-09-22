export const VERSION = 2;
export const HEROES = [
  { id: 'xiao', name: '萧策', title: '运筹之将', mark: '策', hp: 4, skill: '筹谋', type: 'active', target: 'self', color: 'gold', desc: '每回合限一次，额外摸一张牌。', flavor: '局势在变，胜算在握。' },
  { id: 'gu', name: '顾长风', title: '踏阵之锋', mark: '锋', hp: 4, skill: '疾袭', type: 'passive', color: 'red', desc: '每回合可使用两张「破阵」。', flavor: '风过之处，阵无完壁。' },
  { id: 'chu', name: '褚山', title: '不动之垒', mark: '山', hp: 5, skill: '铁壁', type: 'passive', color: 'blue', desc: '自己的回合开始时获得一层护甲，最多两层。', flavor: '一人立，万骑止。' },
  { id: 'su', name: '苏晚棠', title: '悬壶之心', mark: '棠', hp: 3, skill: '济世', type: 'active', target: 'ally', cost: true, color: 'green', desc: '每回合限一次，弃一张手牌，为一名友方恢复一点体力。', flavor: '烽烟不掩，一线生机。' },
  { id: 'lu', name: '陆隐', title: '无声之刃', mark: '隐', hp: 4, skill: '夜取', type: 'active', target: 'enemyHand', cost: true, color: 'purple', desc: '每回合限一次，弃一张手牌，随机夺取一名敌方的一张手牌。', flavor: '灯影未动，胜负已移。' },
  { id: 'shen', name: '沈知微', title: '观星之智', mark: '星', hp: 3, skill: '远略', type: 'passive', color: 'teal', desc: '摸牌阶段额外摸一张牌。', flavor: '落子之前，已见终章。' }
];
export const CARDS = {
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
export const getHero = id => HEROES.find(h => h.id === id);
