import { shuffle, type Random } from './common.ts';
export interface MemoryState {
  cards: number[]; matched: boolean[]; open: number[]; scores: number[];
  turn: number; known: Map<number, number>; done: boolean;
}
export function createMemory(random: Random = Math.random): MemoryState {
  return { cards: shuffle(Array.from({ length: 24 }, (_, i) => i % 12 + 1), random), matched: Array(24).fill(false), open: [], scores: [0, 0], turn: 0, known: new Map(), done: false };
}
export function reveal(s: MemoryState, index: number): boolean {
  if (s.done || s.open.length >= 2 || index < 0 || index >= 24 || s.matched[index] || s.open.includes(index)) return false;
  s.open.push(index); s.known.set(index, s.cards[index]); return true;
}
export function resolvePair(s: MemoryState): void {
  if (s.open.length !== 2) return;
  const [a, b] = s.open;
  if (s.cards[a] === s.cards[b]) {
    s.matched[a] = s.matched[b] = true; s.scores[s.turn]++;
    s.known.delete(a); s.known.delete(b);
  } else s.turn = 1 - s.turn;
  s.open = []; s.done = s.matched.every(Boolean);
}
// AIには公開済みの記憶だけを渡す。伏せたカードの数字にはアクセスしない。
export function memoryMove(view: Pick<MemoryState, 'matched' | 'open' | 'known'>, random: Random = Math.random): number {
  const available = view.matched.flatMap((matched, i) => !matched && !view.open.includes(i) ? [i] : []);
  if (view.open.length === 1) {
    const value = view.known.get(view.open[0]);
    const match = available.find(i => view.known.get(i) === value);
    if (match !== undefined) return match;
  } else {
    for (const i of available) if (available.some(j => j !== i && view.known.has(i) && view.known.get(i) === view.known.get(j))) return i;
  }
  const unknown = available.filter(i => !view.known.has(i));
  const choices = unknown.length ? unknown : available;
  return choices[Math.floor(random() * choices.length)];
}

