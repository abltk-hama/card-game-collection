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
  phase: 'choice' | 'play' | 'interrupt' | 'final' | 'done';
  consecutivePasses: number;
  forced: boolean;
  lastPassBoardSize: number[];
  placements: Record<string, { player: number; points: number }>;
  message: string;
  specials: PointSpecial[][];
  inverted: boolean;
  doubleReady: boolean[];
  remainingPlays: number;
  placedThisTurn: number;
  interrupt: { giver: number; final: boolean } | null;
  freePasses: number[];
  round: number;
  totals: number[];
  bonusOwner: number | null;
  passPlayers: number[];
}
export const pointSpecialKinds = ['flip', 'force', 'double', 'freePass', 'gift'] as const;
export type PointSpecialKind = typeof pointSpecialKinds[number];
export interface PointSpecial { id: string; kind: PointSpecialKind; }
export const pointSpecialNames: Record<PointSpecialKind, string> = { flip: '得点反転', force: '指定配置', double: '連続配置', freePass: 'パス免除', gift: '持ち札渡し' };
export function createPointSevens(random: Random = Math.random, options: { round?: number; totals?: readonly number[]; bonusOwner?: number | null } = {}): PointSevensState {
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
  const round = options.round ?? 1, bonusOwner = options.bonusOwner ?? null;
  const specials = hands.map((_, p) => [{ id: `${round}:${p}:random`, kind: pointSpecialKinds[Math.floor(random() * pointSpecialKinds.length)] }]);
  return { hands, board, turn: bonusOwner ?? turn, scores, passes: [0, 0, 0, 0], penalties: [0, 0, 0, 0], finishOrder: [], phase: bonusOwner === null ? 'play' : 'choice', consecutivePasses: 0, forced: false, lastPassBoardSize: [-1, -1, -1, -1], placements, message: bonusOwner === null ? '初期配置の7は各＋2点。全員に特殊カードを1枚配りました。' : '前ラウンド最下位の追加特殊カードを選んでください。', specials, inverted: false, doubleReady: [false, false, false, false], remainingPlays: 1, placedThisTurn: 0, interrupt: null, freePasses: [0, 0, 0, 0], round, totals: [...(options.totals ?? [0, 0, 0, 0])], bonusOwner, passPlayers: [] };
}
// 出すカード自身が7から途切れずにつながるかで採点する。
// 端側のカードに接続しても、出したカードと7の間に穴が残れば1点。
export function pointSevensValue(board: readonly PlayingCard[], card: PlayingCard, inverted = false): 0 | 1 | 2 {
  if (!sevensSuits.includes(card.suit) || card.rank < 1 || card.rank > 13 || !Number.isInteger(card.rank) || board.some(c => c.id === card.id)) return 0;
  const ranks = new Set(board.filter(c => c.suit === card.suit).map(c => c.rank));
  if (card.rank !== 1 && card.rank !== 13 && !ranks.has(card.rank - 1) && !ranks.has(card.rank + 1)) return 0;
  ranks.add(card.rank);
  for (let rank = Math.min(card.rank, 7); rank <= Math.max(card.rank, 7); rank++) if (!ranks.has(rank)) return inverted ? 2 : 1;
  return inverted ? 1 : 2;
}
function activePlayers(s: PointSevensState): number[] { return [0, 1, 2, 3].filter(p => !s.finishOrder.includes(p)); }
function markFinished(s: PointSevensState, player: number): void {
  if (!s.hands[player].length && !s.finishOrder.includes(player)) {
    s.finishOrder.push(player); s.specials[player] = []; s.doubleReady[player] = false;
    s.message += ' あがりました。';
  }
}
function beginPointTurn(s: PointSevensState): void {
  s.placedThisTurn = 0;
  s.remainingPlays = s.phase === 'play' && s.doubleReady[s.turn] ? 2 : 1;
  s.doubleReady[s.turn] = false;
}
function finishPointRound(s: PointSevensState, player: number): void {
  s.penalties[player] = s.hands[player].length; s.scores[player] -= s.penalties[player];
  if (!s.finishOrder.includes(player)) s.finishOrder.push(player);
  s.phase = 'done'; s.interrupt = null; s.forced = false;
  s.specials = [[], [], [], []]; s.doubleReady = [false, false, false, false];
  s.totals = s.totals.map((v, p) => v + s.scores[p]);
  s.message += ` 残り${s.penalties[player]}枚で－${s.penalties[player]}点。得点が確定しました。`;
}
function advancePoint(s: PointSevensState): void {
  const active = activePlayers(s);
  s.passPlayers = s.passPlayers.filter(p=>active.includes(p));
  s.consecutivePasses = s.passPlayers.length;
  if (s.consecutivePasses >= active.length) s.forced = true;
  if (active.length === 1) {
    s.turn = active[0]; s.phase = 'final'; s.forced = true;
    beginPointTurn(s);
    s.message += ' 最後の1人は1枚出した後、残り手札1枚につき－1点で終了します。'; return;
  }
  for (let n = 1; n <= 4; n++) {
    const p = (s.turn + n) % 4;
    if (active.includes(p)) { s.turn = p; beginPointTurn(s); return; }
  }
}
export function playPointSevens(s: PointSevensState, id: string): boolean {
  if (!['play', 'final', 'interrupt'].includes(s.phase) || s.finishOrder.includes(s.turn)) return false;
  const p = s.turn, hand = s.hands[p], index = hand.findIndex(c => c.id === id);
  if (index < 0) return false;
  const card = hand[index], points = pointSevensValue(s.board, card, s.inverted); if (!points) return false;
  s.board.push(hand.splice(index, 1)[0]); s.scores[p] += points; s.placements[id] = { player: p, points };
  s.consecutivePasses = 0; s.passPlayers = []; s.forced = false; s.message = `${cardLabel(card)}を出して＋${points}点。`;
  if (s.phase === 'final' || s.phase === 'interrupt' && s.interrupt!.final) {
    finishPointRound(s, p); return true;
  }
  markFinished(s, p);
  if (s.phase === 'interrupt') { returnFromInterrupt(s); return true; }
  s.placedThisTurn++; s.remainingPlays--;
  if (hand.length && s.remainingPlays > 0 && hand.some(c => pointSevensValue(s.board, c))) {
    s.message += ' もう1枚出すか、この手番を終了できます。'; return true;
  }
  advancePoint(s); return true;
}
export function endPointSevensTurn(s: PointSevensState): boolean {
  if (s.phase !== 'play' || s.placedThisTurn === 0 || s.remainingPlays === 0) return false;
  s.message = '1枚で手番を終了しました。'; advancePoint(s); return true;
}
function returnFromInterrupt(s: PointSevensState): void {
  s.turn = s.interrupt!.giver; s.interrupt = null; s.phase = 'play'; advancePoint(s);
}
export function skipPointInterrupt(s: PointSevensState): boolean {
  if (s.phase !== 'interrupt' || s.interrupt!.final) return false;
  s.message = '割り込み配置を終了しました。'; returnFromInterrupt(s); return true;
}
export function canPassPointSevens(s: PointSevensState): boolean {
  return s.phase === 'play' && s.placedThisTurn === 0 && !s.finishOrder.includes(s.turn) && (!s.forced || !s.hands[s.turn].some(c => pointSevensValue(s.board, c) > 0));
}
export function passPointSevens(s: PointSevensState): boolean {
  if (!canPassPointSevens(s)) return false;
  recordPointPass(s, false); return true;
}
function recordPointPass(s: PointSevensState, free: boolean): void {
  const p = s.turn;
  if (free) s.freePasses[p]++; else s.scores[p]--;
  s.passes[p]++; s.lastPassBoardSize[p] = s.board.length;
  if (!s.passPlayers.includes(p)) s.passPlayers.push(p);
  s.consecutivePasses = s.passPlayers.length;
  if (s.consecutivePasses >= activePlayers(s).length) s.forced = true;
  s.message = `${free ? 'パス免除で減点なし。' : 'パスして－1点。'}${s.forced ? '強制配置中：出せる人は必ず1枚出してください。' : `連続パス${s.consecutivePasses}人。`}`;
  advancePoint(s);
}
export function pointSevensRanking(s: PointSevensState): number[] {
  return [0, 1, 2, 3].sort((a, b) => s.scores[b] - s.scores[a] || s.finishOrder.indexOf(a) - s.finishOrder.indexOf(b));
}
export interface PointMoveOptions { forced: boolean; lastPassBoardSize: number; inverted?: boolean; }
// 判断材料は自分の手札と公開の場・パス履歴のみ。
export function pointSevensMove(hand: readonly PlayingCard[], board: readonly PlayingCard[], options: PointMoveOptions): string | null {
  const value = (c: PlayingCard) => pointSevensValue(board, c, options.inverted);
  const legal = hand.filter(c => pointSevensValue(board, c) > 0);
  if (!legal.length) return null;
  const priority = (card: PlayingCard) => {
    const after = [...board, card];
    const opens = hand.filter(c => c.id !== card.id && !pointSevensValue(board, c) && pointSevensValue(after, c)).length;
    return value(card) * 100 + opens * 10 + Math.abs(card.rank - 7);
  };
  legal.sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id));
  // ＋1点しか出せず、相手の1枚で自分の2枚以上が7側から出せるなら一度待つ。
  // 同じ盤面では繰り返さず、終盤と強制配置では待たない。
  if (!options.forced && !options.inverted && hand.length > 3 && options.lastPassBoardSize !== board.length && value(legal[0]) === 1) {
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
export function nextPointSevensRound(s: PointSevensState, random: Random = Math.random): PointSevensState {
  if (s.phase !== 'done') throw new Error('Round not finished');
  return createPointSevens(random, { round: s.round + 1, totals: s.totals, bonusOwner: pointSevensRanking(s)[3] });
}
export function choosePointSpecial(s: PointSevensState, kind: PointSpecialKind): boolean {
  if (s.phase !== 'choice' || s.bonusOwner === null || !pointSpecialKinds.includes(kind)) return false;
  s.specials[s.bonusOwner].push({ id: `${s.round}:${s.bonusOwner}:bonus`, kind });
  s.turn = s.placements['♦7'].player; s.phase = 'play'; s.message = '追加カードを選びました。♦7の持ち主から開始します。'; beginPointTurn(s); return true;
}
export function canUsePointSpecial(s: PointSevensState, id: string): boolean {
  return s.phase === 'play' && !s.forced && s.placedThisTurn === 0 && !s.finishOrder.includes(s.turn) && s.specials[s.turn].some(c => c.id === id);
}
export function usePointSpecial(s: PointSevensState, id: string, args: { cardId?: string; target?: number } = {}): boolean {
  if (!canUsePointSpecial(s, id)) return false;
  const p = s.turn, card = s.specials[p].find(c => c.id === id)!;
  let owner = -1, index = -1;
  if (card.kind === 'force') {
    owner = s.hands.findIndex(h => h.some(c => c.id === args.cardId));
    if (owner < 0 || s.finishOrder.includes(owner)) return false;
    index = s.hands[owner].findIndex(c => c.id === args.cardId);
  }
  if (card.kind === 'gift') {
    if (!Number.isInteger(args.target) || args.target! < 0 || args.target! > 3 || args.target === p || s.finishOrder.includes(args.target!)) return false;
    index = s.hands[p].findIndex(c => c.id === args.cardId); if (index < 0) return false;
  }
  s.specials[p] = s.specials[p].filter(c => c.id !== id);
  s.message = `${pointSpecialNames[card.kind]}を使いました。`;
  if (card.kind === 'freePass') { recordPointPass(s, true); return true; }
  if (card.kind === 'flip') { s.inverted = !s.inverted; s.message += s.inverted ? '7側＋1点・未接続＋2点。' : '7側＋2点・未接続＋1点。'; }
  if (card.kind === 'double') { s.doubleReady[p] = true; s.message += '次の自分の手番だけ最大2枚配置できます。'; }
  if (card.kind === 'force') {
    const forcedCard = s.hands[owner].splice(index, 1)[0]; s.board.push(forcedCard); s.scores[owner] += 2; s.placements[forcedCard.id] = { player: owner, points: 2 };
    s.consecutivePasses = 0; s.passPlayers = []; s.forced = false;
    s.message += `${cardLabel(forcedCard)}を即配置して持ち主に＋2点。`; markFinished(s, owner);
  }
  if (card.kind === 'gift') {
    const target = args.target!, given = s.hands[p].splice(index, 1)[0]; s.hands[target].push(given);
    s.hands[target].sort((a,b) => sevensSuits.indexOf(a.suit)-sevensSuits.indexOf(b.suit)||a.rank-b.rank);
    s.message += `${cardLabel(given)}を渡しました。受け取った人は通常手番を消費せず1枚配置できます。`;
    markFinished(s, p); s.interrupt = { giver: p, final: activePlayers(s).length === 1 }; s.turn = target; s.phase = 'interrupt'; s.remainingPlays = 1; s.placedThisTurn = 0;
    if (s.interrupt.final) s.message += 'この割り込みが最終1手です。';
    if (!s.hands[target].some(c => pointSevensValue(s.board, c))) returnFromInterrupt(s);
    return true;
  }
  advancePoint(s); return true;
}

// 非公開の相手手札を読まず、自分のカードを使った配置・譲渡を判断する。
export function pointSpecialMove(s: PointSevensState): { id: string; args: { cardId?: string; target?: number } } | null {
  if (s.phase !== 'play' || s.forced || s.placedThisTurn > 0) return null;
  const p = s.turn, hand = s.hands[p], legal = hand.filter(c => pointSevensValue(s.board,c));
  for (const special of s.specials[p]) {
    if (special.kind === 'force') {
      const chosen = hand.filter(c => pointSevensValue(s.board,c,s.inverted) < 2).sort((a,b) => Math.abs(a.rank-7)-Math.abs(b.rank-7))[0];
      if (chosen) return { id: special.id, args: { cardId: chosen.id } };
    }
    if (special.kind === 'flip') {
      const current = hand.reduce((sum,c)=>sum+pointSevensValue(s.board,c,s.inverted),0), flipped = hand.reduce((sum,c)=>sum+pointSevensValue(s.board,c,!s.inverted),0);
      if (flipped > current + 1) return { id: special.id, args: {} };
    }
    if (special.kind === 'double' && hand.length >= 2 && (legal.length >= 2 || !legal.length)) return { id: special.id, args: {} };
    if (special.kind === 'freePass' && !legal.length) return { id: special.id, args: {} };
    if (special.kind === 'gift') {
      const given = hand.find(c => !pointSevensValue(s.board,c));
      const target = activePlayers(s).filter(q=>q!==p).sort((a,b)=>s.hands[b].length-s.hands[a].length||a-b)[0];
      if (given && target !== undefined) return { id: special.id, args: { cardId: given.id, target } };
    }
  }
  return null;
}
export function pointBonusChoice(s: PointSevensState): PointSpecialKind {
  const p = s.bonusOwner ?? s.turn;
  const legal = s.hands[p].filter(c=>pointSevensValue(s.board,c));
  return legal.length < 2 ? 'force' : s.specials[p].some(c=>c.kind==='double') ? 'flip' : 'double';
}
