import { deck, shuffle, type PlayingCard, type Random } from './common.ts';

export interface MeldAnalysis { melds: PlayingCard[][]; deadwood: PlayingCard[]; points: number; }
export interface Layoff { card: PlayingCard; meld: number; }
export interface GinResult {
  kind: 'knock' | 'gin' | 'undercut' | 'draw'; knocker: number | null; winner: number | null;
  points: number; analyses: MeldAnalysis[]; laidOff: Layoff[];
}
export interface GinState {
  hands: PlayingCard[][]; stock: PlayingCard[]; discard: PlayingCard[];
  dealer: number; turn: number; round: number; scores: number[];
  phase: 'opening' | 'draw' | 'discard' | 'roundOver' | 'matchOver';
  openingPasses: number; mustStock: boolean; forbiddenDiscard: string | null;
  result: GinResult | null; message: string;
}
export function ginPoints(card: PlayingCard): number { return Math.min(card.rank, 10); }
export function sortGin(hand: readonly PlayingCard[]): PlayingCard[] {
  const suits = ['♠', '♥', '♦', '♣'];
  return [...hand].sort((a, b) => suits.indexOf(a.suit) - suits.indexOf(b.suit) || a.rank - b.rank);
}
function meldMasks(hand: readonly PlayingCard[]): number[] {
  const masks: number[] = [];
  const ranks = new Map<number, number[]>();
  hand.forEach((c, i) => ranks.set(c.rank, [...(ranks.get(c.rank) ?? []), i]));
  for (const indices of ranks.values()) {
    if (indices.length < 3) continue;
    for (let subset = 1; subset < 1 << indices.length; subset++) {
      const picked = indices.filter((_, i) => subset & 1 << i);
      if (picked.length >= 3) masks.push(picked.reduce((mask, i) => mask | 1 << i, 0));
    }
  }
  for (const suit of ['♠', '♥', '♦', '♣']) {
    const indices = hand.flatMap((c, i) => c.suit === suit ? [i] : []).sort((a, b) => hand[a].rank - hand[b].rank);
    for (let start = 0; start < indices.length; start++) {
      let mask = 0;
      for (let end = start; end < indices.length; end++) {
        if (end > start && hand[indices[end]].rank !== hand[indices[end - 1]].rank + 1) break;
        mask |= 1 << indices[end];
        if (end - start >= 2) masks.push(mask);
      }
    }
  }
  return masks.sort((a, b) => a - b);
}
function analysis(hand: readonly PlayingCard[], masks: readonly number[]): MeldAnalysis {
  const used = masks.reduce((a, b) => a | b, 0);
  const deadwood = hand.filter((_, i) => !(used & 1 << i));
  return { melds: masks.map(mask => hand.filter((_, i) => mask & 1 << i)), deadwood, points: deadwood.reduce((sum, c) => sum + ginPoints(c), 0) };
}
// メルド候補を列挙して重複しない組み合わせを比較。貪欲法による取りこぼしを避ける。
function layouts(hand: readonly PlayingCard[]): number[][] {
  const candidates = meldMasks(hand), result: number[][] = [];
  function visit(start: number, used: number, chosen: number[]): void {
    result.push(chosen);
    for (let i = start; i < candidates.length; i++) {
      const mask = candidates[i];
      if (!(mask & used)) visit(i + 1, used | mask, [...chosen, mask]);
    }
  }
  visit(0, 0, []); return result;
}
export function analyseGin(hand: readonly PlayingCard[]): MeldAnalysis {
  let best = analysis(hand, []);
  for (const masks of layouts(hand)) {
    const candidate = analysis(hand, masks);
    if (candidate.points < best.points) best = candidate;
  }
  return best;
}
function accepts(meld: readonly PlayingCard[], card: PlayingCard): boolean {
  if (meld.every(c => c.rank === meld[0].rank)) return meld.length < 4 && card.rank === meld[0].rank && !meld.some(c => c.suit === card.suit);
  if (card.suit !== meld[0].suit) return false;
  const ranks = meld.map(c => c.rank);
  return card.rank === Math.min(...ranks) - 1 || card.rank === Math.max(...ranks) + 1;
}
function bestLayoffs(deadwood: readonly PlayingCard[], melds: readonly PlayingCard[][]): { deadwood: PlayingCard[]; laidOff: Layoff[]; points: number } {
  const memo = new Map<string, { deadwood: PlayingCard[]; laidOff: Layoff[]; points: number }>();
  function visit(remaining: PlayingCard[], targets: PlayingCard[][]) {
    const key = `${remaining.map(c => c.id).join(',')}|${targets.map(m => m.map(c => c.id).sort().join(',')).join(';')}`;
    const cached = memo.get(key); if (cached) return cached;
    let best = { deadwood: remaining, laidOff: [] as Layoff[], points: remaining.reduce((sum, c) => sum + ginPoints(c), 0) };
    for (let i = 0; i < remaining.length; i++) for (let m = 0; m < targets.length; m++) {
      const card = remaining[i]; if (!accepts(targets[m], card)) continue;
      const next = targets.map((meld, j) => j === m ? [...meld, card] : meld);
      const option = visit(remaining.filter((_, j) => j !== i), next);
      if (option.points < best.points) best = { ...option, laidOff: [{ card, meld: m }, ...option.laidOff] };
    }
    memo.set(key, best); return best;
  }
  return visit([...deadwood], melds.map(m => [...m]));
}
export function defendGin(hand: readonly PlayingCard[], knockerMelds: readonly PlayingCard[][]): { analysis: MeldAnalysis; laidOff: Layoff[] } {
  let best = { analysis: analyseGin(hand), laidOff: [] as Layoff[] };
  // 自分の組だけの最小点に固定せず、付け札を含めて最小になる組み合わせを選ぶ。
  for (const masks of layouts(hand)) {
    const own = analysis(hand, masks), laid = bestLayoffs(own.deadwood, knockerMelds);
    if (laid.points < best.analysis.points) best = { analysis: { melds: own.melds, deadwood: laid.deadwood, points: laid.points }, laidOff: laid.laidOff };
  }
  return best;
}
export function scoreGin(knockerHand: readonly PlayingCard[], opponentHand: readonly PlayingCard[]): Omit<GinResult, 'knocker' | 'winner'> & { winner: 0 | 1 } {
  const own = analyseGin(knockerHand);
  if (own.points > 10) throw new Error('Cannot knock above 10 deadwood');
  if (own.points === 0) {
    const opponent = analyseGin(opponentHand);
    return { kind: 'gin', winner: 0, points: opponent.points + 25, analyses: [own, opponent], laidOff: [] };
  }
  const defense = defendGin(opponentHand, own.melds), difference = defense.analysis.points - own.points;
  return { kind: difference > 0 ? 'knock' : 'undercut', winner: difference > 0 ? 0 : 1, points: difference > 0 ? difference : 25 - difference, analyses: [own, defense.analysis], laidOff: defense.laidOff };
}
export function createGin(random: Random = Math.random, dealer?: number, scores: readonly number[] = [0, 0], round = 1): GinState {
  const cards = shuffle(deck(), random);
  const actualDealer = dealer ?? Math.floor(random() * 2);
  return {
    hands: [sortGin(cards.splice(0, 10)), sortGin(cards.splice(0, 10))], discard: [cards.pop()!], stock: cards,
    dealer: actualDealer, turn: 1 - actualDealer, round, scores: [...scores], phase: 'opening',
    openingPasses: 0, mustStock: false, forbiddenDiscard: null, result: null,
    message: '最初の捨て札を取るか、見送ってください。',
  };
}
export function nextGinRound(s: GinState, random: Random = Math.random): GinState {
  if (s.phase !== 'roundOver' || !s.result) throw new Error('Cannot start next round');
  return createGin(random, s.result.kind === 'draw' ? s.dealer : 1 - s.dealer, s.scores, s.round + 1);
}
export function declineGin(s: GinState): boolean {
  if (s.phase !== 'opening') return false;
  s.openingPasses++;
  if (s.openingPasses === 1) { s.turn = s.dealer; s.message = '最初の捨て札が見送られました。取るか見送ってください。'; }
  else { s.turn = 1 - s.dealer; s.phase = 'draw'; s.mustStock = true; s.message = '双方が見送ったので、山札から引いてください。'; }
  return true;
}
export function drawGin(s: GinState, source: 'stock' | 'discard'): boolean {
  if (s.phase !== 'opening' && s.phase !== 'draw' || s.phase === 'opening' && source === 'stock' || s.mustStock && source === 'discard') return false;
  const card = source === 'stock' ? s.stock.pop() : s.discard.pop();
  if (!card) return false;
  s.hands[s.turn] = sortGin([...s.hands[s.turn], card]); s.forbiddenDiscard = source === 'discard' ? card.id : null;
  s.phase = 'discard'; s.mustStock = false; s.message = '1枚選んで捨ててください。残り10点以下ならノックできます。'; return true;
}
export function discardGin(s: GinState, id: string, knock = false): boolean {
  if (s.phase !== 'discard' || id === s.forbiddenDiscard) return false;
  const index = s.hands[s.turn].findIndex(c => c.id === id); if (index < 0) return false;
  const remaining = s.hands[s.turn].filter(c => c.id !== id);
  if (knock && analyseGin(remaining).points > 10) return false;
  const player = s.turn;
  s.discard.push(s.hands[player][index]); s.hands[player] = remaining; s.forbiddenDiscard = null;
  if (knock) {
    const scored = scoreGin(remaining, s.hands[1 - player]);
    const winner = scored.winner === 0 ? player : 1 - player;
    const analyses = player === 0 ? scored.analyses : [...scored.analyses].reverse();
    s.result = { ...scored, knocker: player, winner, analyses };
    s.scores[winner] += scored.points;
    s.phase = s.scores[winner] >= 100 ? 'matchOver' : 'roundOver';
    s.message = `${scored.kind === 'gin' ? 'ジン' : scored.kind === 'undercut' ? 'アンダーカット' : 'ノック'}！ ${scored.points}点を獲得。`;
  } else if (s.stock.length <= 2) {
    s.result = { kind: 'draw', knocker: null, winner: null, points: 0, analyses: s.hands.map(analyseGin), laidOff: [] };
    s.phase = 'roundOver'; s.message = '山札が2枚になったため、このラウンドは無得点です。';
  } else { s.turn = 1 - player; s.phase = 'draw'; s.message = '山札か捨て札から1枚引いてください。'; }
  return true;
}
export function chooseGinDiscard(hand: readonly PlayingCard[], forbidden: string | null): { id: string; points: number } {
  let best = { id: '', points: Infinity }, bestPotential = -1, discardedPoints = -1;
  for (const card of hand) {
    if (card.id === forbidden) continue;
    const remaining = hand.filter(c => c.id !== card.id), points = analyseGin(remaining).points;
    const potential = remaining.reduce((total, c, i) => total + remaining.slice(i + 1).filter(other => other.rank === c.rank || other.suit === c.suit && Math.abs(other.rank - c.rank) <= 2).length, 0);
    if (points < best.points || points === best.points && (potential > bestPotential || potential === bestPotential && ginPoints(card) > discardedPoints)) {
      best = { id: card.id, points }; bestPotential = potential; discardedPoints = ginPoints(card);
    }
  }
  return best;
}
// 非公開の相手手札・山札の中身は判断材料にしない。
export function shouldTakeGinDiscard(hand: readonly PlayingCard[], upcard: PlayingCard): boolean {
  return chooseGinDiscard([...hand, upcard], upcard.id).points < analyseGin(hand).points;
}
