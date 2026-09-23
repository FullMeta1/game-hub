export const VERSION = 2;
export const HEROES = [
  { id: 'xiao', name: 'Xiao Ce', title: 'The Strategist', mark: 'XC', hp: 4, skill: 'Plan Ahead', type: 'active', target: 'self', color: 'gold', desc: 'Once per turn, draw one extra card.', flavor: 'Every turn is another move on the board.' },
  { id: 'gu', name: 'Gu Changfeng', title: 'The Vanguard', mark: 'GC', hp: 4, skill: 'Rapid Assault', type: 'passive', color: 'red', desc: 'You may play two Strikes each turn.', flavor: 'A swift attack can break a line.' },
  { id: 'chu', name: 'Chu Shan', title: 'The Bulwark', mark: 'CS', hp: 5, skill: 'Iron Wall', type: 'passive', color: 'blue', desc: 'At the start of your turn, gain 1 armor, up to 2.', flavor: 'Hold the line.' },
  { id: 'su', name: 'Su Wantang', title: 'The Healer', mark: 'SW', hp: 3, skill: 'Field Aid', type: 'active', target: 'ally', cost: true, color: 'green', desc: 'Once per turn, discard a card to heal an ally for 1.', flavor: 'There is still a way back.' },
  { id: 'lu', name: 'Lu Yin', title: 'The Shadow', mark: 'LY', hp: 4, skill: 'Night Raid', type: 'active', target: 'enemyHand', cost: true, color: 'purple', desc: 'Once per turn, discard a card to steal a random card from an enemy.', flavor: 'The quiet move wins the round.' },
  { id: 'shen', name: 'Shen Zhiwei', title: 'The Seer', mark: 'SZ', hp: 3, skill: 'Long View', type: 'passive', color: 'teal', desc: 'Draw one extra card at the start of your turn.', flavor: 'Think two turns ahead.' }
];
export const CARDS = {
  strike: { name: 'Strike', glyph: 'ST', kind: 'Basic', color: 'red', count: 24, target: 'enemy', text: 'Deal 1 damage. Usually once per turn; Dodge can block it.' },
  dodge: { name: 'Dodge', glyph: 'DG', kind: 'Response', color: 'blue', count: 16, target: 'none', text: 'Automatically block a Strike or Arrow Volley aimed at you.' },
  heal: { name: 'Field Medic', glyph: 'HE', kind: 'Basic', color: 'green', count: 8, target: 'ally', text: 'Heal an ally for 1. Automatically used to save yourself at 0 HP.' },
  draw: { name: 'Supply', glyph: 'SP', kind: 'Tactic', color: 'gold', count: 6, target: 'self', text: 'Draw two cards.' },
  fire: { name: 'Fire Attack', glyph: 'FI', kind: 'Tactic', color: 'red', count: 6, target: 'enemy', text: 'Deal 1 damage to an enemy. Dodge cannot block it.' },
  duel: { name: 'Duel', glyph: 'DU', kind: 'Tactic', color: 'purple', count: 4, target: 'enemy', text: 'Both sides automatically exchange Strikes, starting with the target. The first unable to respond takes 1 damage.' },
  steal: { name: 'Sleight', glyph: 'SL', kind: 'Tactic', color: 'purple', count: 4, target: 'enemyHand', text: 'Steal one random card from an enemy hand.' },
  disarm: { name: 'Disarm', glyph: 'DI', kind: 'Tactic', color: 'gold', count: 3, target: 'enemyResource', text: 'Remove all armor from an enemy and discard one random card from their hand, if any.' },
  arrows: { name: 'Arrow Volley', glyph: 'AR', kind: 'Tactic', color: 'red', count: 3, target: 'self', text: 'Deal 1 damage to every enemy. Each may automatically Dodge.' },
  shield: { name: 'Armor', glyph: 'AM', kind: 'Gear', color: 'blue', count: 3, target: 'self', text: 'Set your armor to 2. Each point absorbs 1 damage.' },
  rally: { name: 'Battle Order', glyph: 'BO', kind: 'Tactic', color: 'gold', count: 3, target: 'self', text: 'Your next Strike this turn deals +1 damage. Draw one card. Does not stack.' },
  mend: { name: 'Resupply', glyph: 'RS', kind: 'Tactic', color: 'green', count: 4, target: 'self', text: 'Heal yourself for 1 and draw one card.' }
};
export const getHero = id => HEROES.find(h => h.id === id);
