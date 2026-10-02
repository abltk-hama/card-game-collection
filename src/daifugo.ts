import { deck, shuffle, type PlayingCard, type Random } from './common.ts';

export const classNames = ['大富豪', '富豪', '貧民', '大貧民'];
export interface DaifugoState {
  hands: PlayingCard[][];
  table: PlayingCard[];
  spent: PlayingCard[];
  retired: PlayingCard[];
  turn: number;
  leader: number | null;
  passed: boolean[];
  revolution: boolean;
  order: number[];
  previousOrder: number[];
  fallen: number | null;
  round: number;
  phase: 'exchange' | 'play' | 'done';
  exchangeCount: number;
  message: string;
}
export function strength(rank: number): number { return rank < 3 ? rank + 13 : rank; }
export function sorted(hand: readonly PlayingCard[]): PlayingCard[] {
  return [...hand].sort((a, b) => strength(a.rank) - strength(b.rank) || a.id.localeCompare(b.id));
}
function active(s: DaifugoState, player: number): boolean {
  return player !== s.fallen && !s.order.includes(player) && s.hands[player].length > 0;
}
function nextActive(s: DaifugoState, from: number, skipPassed = false): number {
  for (let n = 1; n <= 4; n++) {
    const player = (from + n) % 4;
    if (active(s, player) && (!skipPassed || !s.passed[player])) return player;
  }
  return -1;
}
export function createDaifugo(random: Random = Math.random, previousOrder: readonly number[] = [], round = 1): DaifugoState {
  const hands: PlayingCard[][] = [[], [], [], []];
  shuffle(deck(), random).forEach((card, i) => hands[i % 4].push(card));
  const s: DaifugoState = {
    hands: hands.map(sorted), table: [], spent: [], retired: [], turn: 0, leader: null,
    passed: [false, false, false, false], revolution: false, order: [], previousOrder: [...previousOrder],
    fallen: null, round, phase: 'play', exchangeCount: 0, message: '同じ数字を選んで「出す」を押そう。',
  };
  if (previousOrder.length) {
    if (previousOrder.length !== 4 || new Set(previousOrder).size !== 4 || previousOrder.some(p => !Number.isInteger(p) || p < 0 || p > 3)) throw new Error('Invalid previous order');
    s.phase = 'exchange';
    const position = previousOrder.indexOf(0);
    if (position < 2) { s.exchangeCount = position === 0 ? 2 : 1; s.phase = 'exchange'; s.message = `交換するカードを${s.exchangeCount}枚選んでください。`; }
    else exchangeCards(s, []);
  } else s.turn = s.hands.findIndex(hand => hand.some(c => c.id === '♦3'));
  return s;
}
export function nextRound(s: DaifugoState, random: Random = Math.random): DaifugoState {
  if (s.phase !== 'done') throw new Error('Round has not finished');
  return createDaifugo(random, s.order, s.round + 1);
}
// 交換前の手札からすべての贈与を決め、受け取ったカードを再度渡さない。
export function exchangeCards(s: DaifugoState, chosenIds: readonly string[]): boolean {
  if (!s.previousOrder.length || s.phase !== 'exchange') return false;
  const humanPosition = s.previousOrder.indexOf(0);
  const required = humanPosition === 0 ? 2 : humanPosition === 1 ? 1 : 0;
  if (chosenIds.length !== required || new Set(chosenIds).size !== required || chosenIds.some(id => !s.hands[0].some(c => c.id === id))) return false;
  const transfers: { from: number; to: number; cards: PlayingCard[] }[] = [];
  for (const [highIndex, lowIndex, count] of [[0, 3, 2], [1, 2, 1]]) {
    const high = s.previousOrder[highIndex], low = s.previousOrder[lowIndex];
    const give = high === 0 ? s.hands[0].filter(c => chosenIds.includes(c.id)) : sorted(s.hands[high]).slice(0, count);
    transfers.push({ from: high, to: low, cards: give }, { from: low, to: high, cards: sorted(s.hands[low]).slice(-count) });
  }
  for (const t of transfers) s.hands[t.from] = s.hands[t.from].filter(c => !t.cards.some(gift => gift.id === c.id));
  for (const t of transfers) s.hands[t.to].push(...t.cards);
  s.hands = s.hands.map(sorted); s.turn = s.previousOrder[3]; s.phase = 'play'; s.exchangeCount = 0;
  s.message = 'カード交換が完了。前回の大貧民から開始します。';
  return true;
}
export function canPlayDaifugo(s: Pick<DaifugoState, 'table' | 'revolution'>, hand: readonly PlayingCard[], ids: readonly string[]): boolean {
  if (!ids.length || ids.length > 4 || new Set(ids).size !== ids.length) return false;
  const cards = ids.map(id => hand.find(c => c.id === id));
  if (cards.some(c => !c)) return false;
  const rank = cards[0]!.rank;
  if (cards.some(c => c!.rank !== rank)) return false;
  if (!s.table.length) return true;
  if (cards.length !== s.table.length) return false;
  return s.revolution ? strength(rank) < strength(s.table[0].rank) : strength(rank) > strength(s.table[0].rank);
}
function finishIfNeeded(s: DaifugoState): boolean {
  const remaining = [0, 1, 2, 3].filter(p => active(s, p));
  if (remaining.length > 1) return false;
  s.order.push(...remaining);
  if (s.fallen !== null) s.order.push(s.fallen);
  s.phase = 'done'; s.message = 'ラウンド終了！ 順位が決まりました。'; return true;
}
function clearTable(s: DaifugoState): void {
  const leader = s.leader!;
  s.table = []; s.passed.fill(false);
  s.turn = active(s, leader) ? leader : nextActive(s, leader);
  s.leader = null;
}
function continueTrick(s: DaifugoState): void {
  const challengers = [0, 1, 2, 3].filter(p => active(s, p) && p !== s.leader && !s.passed[p]);
  if (!challengers.length) { clearTable(s); s.message += ' 場が流れました。'; }
  else s.turn = nextActive(s, s.turn, true);
}
export function playDaifugo(s: DaifugoState, ids: readonly string[]): boolean {
  if (s.phase !== 'play' || !active(s, s.turn) || s.passed[s.turn] || !canPlayDaifugo(s, s.hands[s.turn], ids)) return false;
  const player = s.turn, cards = s.hands[player].filter(c => ids.includes(c.id));
  s.hands[player] = s.hands[player].filter(c => !ids.includes(c.id));
  s.table = cards; s.spent.push(...cards); s.leader = player;
  s.message = `${cards[0].rank === 1 ? 'A' : cards[0].rank === 11 ? 'J' : cards[0].rank === 12 ? 'Q' : cards[0].rank === 13 ? 'K' : cards[0].rank}を${cards.length}枚出しました。`;
  if (cards.length === 4) { s.revolution = !s.revolution; s.message += s.revolution ? ' 革命！' : ' 革命が戻りました！'; }
  if (!s.hands[player].length) {
    s.order.push(player); s.message += ' あがり！';
    const formerTop = s.previousOrder[0];
    if (s.order.length === 1 && formerTop !== undefined && formerTop !== player) {
      s.fallen = formerTop; s.retired.push(...s.hands[formerTop]); s.hands[formerTop] = [];
      s.message += ' 前回の大富豪が都落ち。';
    }
  }
  if (finishIfNeeded(s)) return true;
  if (cards[0].rank === 8) { clearTable(s); s.message += ' 8切り！'; }
  else continueTrick(s);
  return true;
}
export function passDaifugo(s: DaifugoState): boolean {
  if (s.phase !== 'play' || !s.table.length || !active(s, s.turn) || s.passed[s.turn] || s.turn === s.leader) return false;
  s.passed[s.turn] = true; s.message = 'パスしました。'; continueTrick(s); return true;
}
// 相手の非公開手札は受け取らず、自分の手札と場だけから合法手を選ぶ。
export function daifugoMove(hand: readonly PlayingCard[], table: readonly PlayingCard[], revolution: boolean): string[] {
  const groups = new Map<number, PlayingCard[]>();
  for (const card of hand) groups.set(card.rank, [...(groups.get(card.rank) ?? []), card]);
  const candidates = [...groups.values()].sort((a, b) => revolution ? strength(b[0].rank) - strength(a[0].rank) : strength(a[0].rank) - strength(b[0].rank));
  for (const group of candidates) {
    const ids = group.slice(0, table.length || group.length).map(c => c.id);
    if (canPlayDaifugo({ table: [...table], revolution }, hand, ids)) return ids;
  }
  return [];
}
