import { deck, shuffle, type PlayingCard, type Random } from './common.ts';
export interface OldMaidState { hands: PlayingCard[][]; turn: number; done: boolean; loser: number | null; message: string; }
export function removePairs(hand: PlayingCard[]): PlayingCard[] {
  const remaining: PlayingCard[] = [];
  for (const card of hand) {
    const index = remaining.findIndex(c => c.rank === card.rank && card.rank !== 0);
    if (index < 0) remaining.push(card); else remaining.splice(index, 1);
  }
  return remaining;
}
export function createOldMaid(random: Random = Math.random): OldMaidState {
  const hands: PlayingCard[][] = [[], [], [], []];
  shuffle([...deck(), { id: 'joker', rank: 0, suit: '★' }], random).forEach((c, i) => hands[i % 4].push(c));
  const s = { hands: hands.map(h => shuffle(removePairs(h), random)), turn: 0, done: false, loser: null, message: '隣の相手からカードを1枚引こう。' } as OldMaidState;
  if (!s.hands[0].length) s.turn = nextPlayer(s, 0);
  finish(s); return s;
}
export function nextPlayer(s: OldMaidState, from: number): number {
  for (let n = 1; n <= 4; n++) if (s.hands[(from + n) % 4].length) return (from + n) % 4;
  return from;
}
function finish(s: OldMaidState): void {
  const active = s.hands.flatMap((h, i) => h.length ? [i] : []);
  if (active.length <= 1) { s.done = true; s.loser = active[0] ?? null; }
}
export function takeCard(s: OldMaidState, index: number, random: Random = Math.random): boolean {
  if (s.done) return false;
  const target = nextPlayer(s, s.turn);
  if (target === s.turn || index < 0 || index >= s.hands[target].length) return false;
  const card = s.hands[target].splice(index, 1)[0];
  const before = s.hands[s.turn].length;
  s.hands[s.turn] = shuffle(removePairs([...s.hands[s.turn], card]), random);
  s.message = s.hands[s.turn].length < before ? 'ペアが揃いました！' : 'カードを1枚引きました。';
  finish(s); if (!s.done) s.turn = nextPlayer(s, s.turn);
  return true;
}

