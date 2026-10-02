import { cardLabel, deck, shuffle, type PlayingCard, type Random } from './common.ts';
import { sevensSuits } from './sevens.ts';

export interface PointSevensState {
  hands: PlayingCard[][];
  board: PlayingCard[];
  turn: number;
  scores: number[];
  passes: number[];
  penalties: number[];
  finishOrder: number[];
  phase: 'play' | 'final' | 'done';
  consecutivePasses: number;
  forced: boolean;
  lastPassBoardSize: number[];
  placements: Record<string, { player: number; points: number }>;
  message: string;
}
export function createPointSevens(random: Random = Math.random): PointSevensState {
  const hands: PlayingCard[][] = [[], [], [], []], board: PlayingCard[] = [];
  const scores = [0, 0, 0, 0], placements: PointSevensState['placements'] = {};
  let turn = 0;
  shuffle(deck(), random).forEach((card, i) => {
    const player = i % 4;
    if (card.rank === 7) {
      board.push(card); scores[player] += 2; placements[card.id] = { player, points: 2 };
      if (card.suit === '♦') turn = player;
    } else hands[player].push(card);
  });
  hands.forEach(h => h.sort((a, b) => sevensSuits.indexOf(a.suit) - sevensSuits.indexOf(b.suit) || a.rank - b.rank));
  return { hands, board, turn, scores, passes: [0, 0, 0, 0], penalties: [0, 0, 0, 0], finishOrder: [], phase: 'play', consecutivePasses: 0, forced: false, lastPassBoardSize: [-1, -1, -1, -1], placements, message: '初期配置の7は各＋2点。出すカードの点数を選んでください。' };
}
// 出すカード自身が7から途切れずにつながるかで採点する。
// 端側のカードに接続しても、出したカードと7の間に穴が残れば1点。
export function pointSevensValue(board: readonly PlayingCard[], card: PlayingCard): 0 | 1 | 2 {
  if (!sevensSuits.includes(card.suit) || card.rank < 1 || card.rank > 13 || !Number.isInteger(card.rank) || board.some(c => c.id === card.id)) return 0;
  const ranks = new Set(board.filter(c => c.suit === card.suit).map(c => c.rank));
  if (card.rank !== 1 && card.rank !== 13 && !ranks.has(card.rank - 1) && !ranks.has(card.rank + 1)) return 0;
  ranks.add(card.rank);
  for (let rank = Math.min(card.rank, 7); rank <= Math.max(card.rank, 7); rank++) if (!ranks.has(rank)) return 1;
  return 2;
}
function activePlayers(s: PointSevensState): number[] { return [0, 1, 2, 3].filter(p => !s.finishOrder.includes(p)); }
function advancePoint(s: PointSevensState): void {
  const active = activePlayers(s);
  if (active.length === 1) {
    s.turn = active[0]; s.phase = 'final'; s.forced = true;
    s.message += ' 最後の1人は1枚出した後、残り手札1枚につき－1点で終了します。'; return;
  }
  for (let n = 1; n <= 4; n++) {
    const p = (s.turn + n) % 4;
    if (active.includes(p)) { s.turn = p; return; }
  }
}
export function playPointSevens(s: PointSevensState, id: string): boolean {
  if (s.phase === 'done' || s.finishOrder.includes(s.turn)) return false;
  const p = s.turn, hand = s.hands[p], index = hand.findIndex(c => c.id === id);
  if (index < 0) return false;
  const card = hand[index], points = pointSevensValue(s.board, card); if (!points) return false;
  s.board.push(hand.splice(index, 1)[0]); s.scores[p] += points; s.placements[id] = { player: p, points };
  s.consecutivePasses = 0; s.forced = false; s.message = `${cardLabel(card)}を出して＋${points}点。`;
  if (s.phase === 'final') {
    s.penalties[p] = hand.length; s.scores[p] -= hand.length; s.finishOrder.push(p); s.phase = 'done';
    s.message += ` 残り${hand.length}枚で－${hand.length}点。得点が確定しました。`; return true;
  }
  if (!hand.length) { s.finishOrder.push(p); s.message += ' あがりました。'; }
  advancePoint(s); return true;
}
export function canPassPointSevens(s: PointSevensState): boolean {
  return s.phase === 'play' && !s.finishOrder.includes(s.turn) && (!s.forced || !s.hands[s.turn].some(c => pointSevensValue(s.board, c) > 0));
}
export function passPointSevens(s: PointSevensState): boolean {
  if (!canPassPointSevens(s)) return false;
  const p = s.turn;
  s.scores[p]--; s.passes[p]++; s.lastPassBoardSize[p] = s.board.length; s.consecutivePasses++;
  if (s.consecutivePasses >= activePlayers(s).length) s.forced = true;
  s.message = `パスして－1点。${s.forced ? '強制配置中：出せる人は必ず1枚出してください。' : `連続パス${s.consecutivePasses}人。`}`;
  advancePoint(s); return true;
}
export function pointSevensRanking(s: PointSevensState): number[] {
  return [0, 1, 2, 3].sort((a, b) => s.scores[b] - s.scores[a] || s.finishOrder.indexOf(a) - s.finishOrder.indexOf(b));
}
export interface PointMoveOptions { forced: boolean; lastPassBoardSize: number; }
// 判断材料は自分の手札と公開の場・パス履歴のみ。
export function pointSevensMove(hand: readonly PlayingCard[], board: readonly PlayingCard[], options: PointMoveOptions): string | null {
  const legal = hand.filter(c => pointSevensValue(board, c) > 0);
  if (!legal.length) return null;
  const priority = (card: PlayingCard) => {
    const after = [...board, card];
    const opens = hand.filter(c => c.id !== card.id && !pointSevensValue(board, c) && pointSevensValue(after, c)).length;
    return pointSevensValue(board, card) * 100 + opens * 10 + Math.abs(card.rank - 7);
  };
  legal.sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id));
  // ＋1点しか出せず、相手の1枚で自分の2枚以上が7側から出せるなら一度待つ。
  // 同じ盤面では繰り返さず、終盤と強制配置では待たない。
  if (!options.forced && hand.length > 3 && options.lastPassBoardSize !== board.length && pointSevensValue(board, legal[0]) === 1) {
    for (const suit of sevensSuits) for (const step of [-1, 1]) {
      const laid = new Set(board.filter(c => c.suit === suit).map(c => c.rank));
      const own = new Set(hand.filter(c => c.suit === suit).map(c => c.rank));
      let missing = 0, ownCount = 0;
      for (let rank = 7 + step; rank >= 1 && rank <= 13; rank += step) {
        if (laid.has(rank)) continue;
        if (own.has(rank)) ownCount++; else missing++;
        if (missing > 1) break;
        if (missing === 1 && ownCount >= 2 && legal.some(c => c.suit === suit && own.has(c.rank))) return null;
      }
    }
  }
  return legal[0].id;
}
