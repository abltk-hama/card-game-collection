import { deck, shuffle, type PlayingCard, type Random } from './common.ts';

export const sevensSuits = ['♠', '♥', '♦', '♣'];
export interface SevensState {
  hands: PlayingCard[][];
  board: PlayingCard[];
  turn: number;
  passes: number[];
  ranks: (number | null)[];
  outcomes: ('playing' | 'finished' | 'dropped' | 'last')[];
  done: boolean;
  message: string;
}
export function createSevens(random: Random = Math.random): SevensState {
  const hands: PlayingCard[][] = [[], [], [], []];
  shuffle(deck(), random).forEach((card, i) => hands[i % 4].push(card));
  const turn = hands.findIndex(h => h.some(c => c.id === '♦7'));
  const board = hands.flat().filter(c => c.rank === 7);
  return { hands: hands.map(h => h.filter(c => c.rank !== 7).sort((a, b) => sevensSuits.indexOf(a.suit) - sevensSuits.indexOf(b.suit) || a.rank - b.rank)), board, turn, passes: [0, 0, 0, 0], ranks: [null, null, null, null], outcomes: ['playing', 'playing', 'playing', 'playing'], done: false, message: '7を場に置きました。出せるカードを1枚選んでください。' };
}
export function canPlaceSevens(board: readonly PlayingCard[], card: PlayingCard): boolean {
  return card.rank >= 1 && card.rank <= 13 && !board.some(c => c.id === card.id) && board.some(c => c.suit === card.suit && Math.abs(c.rank - card.rank) === 1);
}
function advance(s: SevensState): void {
  const active = s.outcomes.flatMap((outcome, p) => outcome === 'playing' ? [p] : []);
  if (active.length === 1) {
    const p = active[0];
    s.ranks[p] = [1, 2, 3, 4].find(rank => !s.ranks.includes(rank))!;
    s.outcomes[p] = 'last'; s.done = true;
    s.message += ' 全員の順位が決まりました。';
    return;
  }
  for (let n = 1; n <= 4; n++) {
    const p = (s.turn + n) % 4;
    if (s.outcomes[p] === 'playing') { s.turn = p; return; }
  }
}
export function playSevens(s: SevensState, id: string): boolean {
  if (s.done || s.outcomes[s.turn] !== 'playing') return false;
  const hand = s.hands[s.turn], index = hand.findIndex(c => c.id === id);
  if (index < 0 || !canPlaceSevens(s.board, hand[index])) return false;
  s.board.push(hand.splice(index, 1)[0]); s.message = 'カードを出しました。';
  if (!hand.length) {
    s.ranks[s.turn] = s.outcomes.filter(o => o === 'finished').length + 1;
    s.outcomes[s.turn] = 'finished'; s.message = `${s.ranks[s.turn]}位であがりました。`;
  }
  advance(s); return true;
}
export function passSevens(s: SevensState): boolean {
  if (s.done || s.outcomes[s.turn] !== 'playing') return false;
  const p = s.turn;
  s.passes[p]++;
  s.message = `パスしました。残り${3 - s.passes[p]}回。`;
  if (s.passes[p] === 4) {
    s.ranks[p] = 4 - s.outcomes.filter(o => o === 'dropped').length;
    s.outcomes[p] = 'dropped';
    s.board.push(...s.hands[p]); s.hands[p] = [];
    s.message = `4回目のパスで脱落。${s.ranks[p]}位です。残りの手札を場に置きました。`;
  }
  advance(s); return true;
}
// 自分の手札と公開された場だけを用いる。次に自分のカードを出せる位置を優先。
export function sevensMove(hand: readonly PlayingCard[], board: readonly PlayingCard[]): string | null {
  const legal = hand.filter(c => canPlaceSevens(board, c));
  const value = (card: PlayingCard) => {
    const nextBoard = [...board, card];
    return hand.filter(c => c.id !== card.id && !canPlaceSevens(board, c) && canPlaceSevens(nextBoard, c)).length * 20 + Math.abs(card.rank - 7);
  };
  legal.sort((a, b) => value(b) - value(a) || a.id.localeCompare(b.id));
  return legal[0]?.id ?? null;
}
