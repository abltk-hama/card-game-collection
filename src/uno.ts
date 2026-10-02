import { shuffle, type Random } from './common.ts';
export const colors = ['red', 'yellow', 'green', 'blue'] as const;
export type Color = typeof colors[number];
export type Kind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'draw4' | 'swap' | 'shield' | 'all';
export interface UnoCard { id: number; color: Color | null; kind: Kind; value?: number; }
export interface UnoState {
  hands: UnoCard[][]; drawPile: UnoCard[]; discard: UnoCard[]; color: Color;
  turn: number; direction: number; shields: boolean[]; winner: number | null;
  tie: boolean; stalls: number; drawnId: number | null; message: string;
}
export function unoDeck(custom: boolean): UnoCard[] {
  const cards: UnoCard[] = [];
  const add = (color: Color | null, kind: Kind, value?: number) => cards.push({ id: cards.length, color, kind, value });
  for (const color of colors) {
    add(color, 'number', 0);
    for (let copy = 0; copy < 2; copy++) {
      for (let n = 1; n <= 9; n++) add(color, 'number', n);
      for (const kind of ['skip', 'reverse', 'draw2'] as const) add(color, kind);
    }
  }
  for (let i = 0; i < 4; i++) { add(null, 'wild'); add(null, 'draw4'); }
  if (custom) for (let i = 0; i < 2; i++) for (const kind of ['swap', 'shield', 'all'] as const) add(null, kind);
  return cards;
}
export function createUno(custom: boolean, random: Random = Math.random): UnoState {
  const pile = shuffle(unoDeck(custom), random);
  const hands = Array.from({ length: 4 }, () => pile.splice(0, 7));
  const start = pile.findIndex(c => c.kind === 'number');
  const first = pile.splice(start, 1)[0];
  return { hands, drawPile: pile, discard: [first], color: first.color!, turn: 0, direction: 1, shields: [false, false, false, false], winner: null, tie: false, stalls: 0, drawnId: null, message: '色か数字・記号が同じカードを出そう。' };
}
export function canPlay(card: UnoCard, hand: readonly UnoCard[], top: UnoCard, color: Color): boolean {
  if (card.kind === 'draw4') return !hand.some(c => c.color === color);
  if (card.color === null) return true;
  return card.color === color || (card.kind === 'number' && top.kind === 'number' ? card.value === top.value : card.kind === top.kind);
}
function advance(s: UnoState, steps = 1): void { s.turn = (s.turn + s.direction * steps + 8) % 4; s.drawnId = null; }
export function drawCards(s: UnoState, player: number, count: number, random: Random = Math.random): UnoCard[] {
  const result: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    if (!s.drawPile.length && s.discard.length > 1) {
      const top = s.discard.pop()!; s.drawPile = shuffle(s.discard, random); s.discard = [top];
    }
    const card = s.drawPile.pop(); if (!card) break;
    s.hands[player].push(card); result.push(card);
  }
  return result;
}
function attack(s: UnoState, player: number, count: number, random: Random): void {
  if (s.shields[player]) s.shields[player] = false;
  else drawCards(s, player, count, random);
}
export function playUno(s: UnoState, index: number, chosenColor?: Color, target?: number, random: Random = Math.random): boolean {
  if (s.winner !== null || s.tie) return false;
  const player = s.turn, hand = s.hands[player], card = hand[index];
  if (!card || (s.drawnId !== null && card.id !== s.drawnId) || !canPlay(card, hand, s.discard[s.discard.length - 1], s.color)) return false;
  if (card.color === null && (!chosenColor || !colors.includes(chosenColor))) return false;
  if (card.kind === 'swap' && (target === undefined || !Number.isInteger(target) || target < 0 || target > 3 || target === player)) return false;
  hand.splice(index, 1); s.discard.push(card); s.color = card.color ?? chosenColor!;
  s.stalls = 0; s.drawnId = null;
  let steps = 1;
  if (card.kind === 'reverse') s.direction *= -1;
  if (card.kind === 'skip') steps = 2;
  if (card.kind === 'draw2' || card.kind === 'draw4') {
    attack(s, (player + s.direction + 4) % 4, card.kind === 'draw2' ? 2 : 4, random); steps = 2;
  }
  if (card.kind === 'shield') s.shields[player] = true;
  if (card.kind === 'all') for (let p = 0; p < 4; p++) if (p !== player) attack(s, p, 1, random);
  if (card.kind === 'swap') [s.hands[player], s.hands[target!]] = [s.hands[target!], s.hands[player]];
  s.message = `${unoLabel(card)}を出しました。`;
  if (!s.hands[player].length) s.winner = player;
  else if (card.kind === 'swap' && !s.hands[target!].length) s.winner = target!;
  if (s.winner === null) advance(s, steps);
  return true;
}
export function drawTurn(s: UnoState, random: Random = Math.random): boolean {
  if (s.winner !== null || s.tie || s.drawnId !== null) return false;
  const cards = drawCards(s, s.turn, 1, random);
  if (!cards.length) {
    if (s.hands[s.turn].some(c => canPlay(c, s.hands[s.turn], s.discard[s.discard.length - 1], s.color))) {
      s.message = '山札が空です。出せる手札を選んでください。'; s.stalls = 0; return false;
    }
    s.stalls++; s.message = '山札がなく、手番を終了しました。';
    if (s.stalls >= 4) s.tie = true; else advance(s);
    return true;
  }
  s.stalls = 0;
  const card = cards[0];
  if (canPlay(card, s.hands[s.turn], s.discard[s.discard.length - 1], s.color)) {
    s.drawnId = card.id; s.message = '引いたカードを出すか、手番を終了できます。';
  } else { s.message = '1枚引いて手番を終了しました。'; advance(s); }
  return true;
}
export function passUno(s: UnoState): boolean {
  if (s.drawnId === null || s.winner !== null || s.tie) return false;
  s.message = '引いたカードを手札に残しました。'; advance(s); return true;
}
export function unoLabel(card: UnoCard): string {
  return card.kind === 'number' ? String(card.value) : ({ skip: 'SKIP', reverse: '↔', draw2: '+2', wild: 'COLOR', draw4: '+4', swap: '交換', shield: '防御', all: '全員+1' })[card.kind];
}
// AIの判断材料は自身の手札・場・公開されている枚数のみ。
export function unoMove(hand: readonly UnoCard[], top: UnoCard, color: Color, counts: readonly number[], player: number, drawnId: number | null) {
  const playable = hand.flatMap((c, i) => (drawnId === null || c.id === drawnId) && canPlay(c, hand, top, color) ? [i] : []);
  const index = playable.sort((a, b) => Number(hand[a].color === null) - Number(hand[b].color === null))[0];
  const chosenColor = [...colors].sort((a, b) => hand.filter(c => c.color === b).length - hand.filter(c => c.color === a).length)[0];
  const target = counts.map((count, i) => ({ count, i })).filter(p => p.i !== player).sort((a, b) => a.count - b.count)[0].i;
  return { index, color: chosenColor, target };
}

