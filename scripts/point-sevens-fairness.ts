import { writeFileSync } from 'node:fs';
import { createPointSevens, pointSevensValue, pointSevensMove, pointSevensRanking, playPointSevens, passPointSevens, type PointSevensState } from '../src/point-sevens.ts';

// node --experimental-strip-types scripts/point-sevens-fairness.ts [配札数]
// 開始位置以外は同じ配札を保持。4開始位置×3方針の結果を記録する。
const deals = Number(process.argv[2] ?? 1200);
if (!Number.isInteger(deals) || deals < 1 || deals > 100000) throw new Error('Invalid deal count');
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
type Policy = 'strategic' | 'always_place' | 'random_place';
const policies: Policy[] = ['strategic', 'always_place', 'random_place'];
function choose(s: PointSevensState, policy: Policy, random: () => number): string | null {
  const hand = s.hands[s.turn];
  if (policy === 'random_place') {
    const legal = hand.filter(c => pointSevensValue(s.board, c));
    return legal.length ? legal[Math.floor(random() * legal.length)].id : null;
  }
  return pointSevensMove(hand, s.board, { forced: s.forced || policy === 'always_place', lastPassBoardSize: s.lastPassBoardSize[s.turn] });
}
function cell() { return { n: 0, score: 0, wins: 0, passes: 0, credit: 0 }; }
function summary(c: ReturnType<typeof cell>) {
  return { n: c.n, meanScore: c.score / c.n, winPercent: 100 * c.wins / c.n, meanPasses: c.passes / c.n, meanCardCredit: c.credit / c.n };
}
const results = [];
for (const policy of policies) {
  const seat = Array.from({ length: 4 }, cell), rank = Array.from({ length: 13 }, cell);
  const middle = { '0–2': cell(), '3–4': cell(), '5以上': cell() }, sevens = { '0': cell(), '1': cell(), '2以上': cell() };
  const actualSeat = Array.from({ length: 4 }, cell), actualMiddle = { '0–2': cell(), '3–4': cell(), '5以上': cell() };
  let games = 0, onePoint = 0, twoPoint = 0, forced = 0, voluntaryPasses = 0, lastWins = 0, firstWins = 0, maxTurns = 0, finalCards = 0;
  const paired: number[] = [];
  for (let deal = 0; deal < deals; deal++) {
    const base = createPointSevens(seeded(20261003 + deal));
    const initial = base.hands.map((h, p) => [...h, ...base.board.filter(c => base.placements[c.id].player === p)]);
    const starts = [];
    for (let offset = 0; offset < 4; offset++) {
      const s = structuredClone(base), random = seeded(91731 + deal * 4 + offset); s.turn = (base.turn + offset) % 4;
      const starter = s.turn; let turns = 0;
      while (s.phase !== 'done' && turns++ < 1600) {
        const hadMove = s.hands[s.turn].some(c => pointSevensValue(s.board, c) > 0);
        const id = choose(s, policy, random), wasForced = s.forced;
        if (id) {
          const value = pointSevensValue(s.board, s.hands[s.turn].find(c => c.id === id)!);
          if (value === 1) onePoint++; else twoPoint++;
          if (!playPointSevens(s, id)) throw new Error('Illegal AI placement');
        } else {
          if (hadMove) voluntaryPasses++;
          if (!passPointSevens(s)) throw new Error('Illegal AI pass');
          if (!wasForced && s.forced) forced++;
        }
      }
      if (s.phase !== 'done' || new Set([...s.board, ...s.hands.flat()].map(c => c.id)).size !== 52) throw new Error('Invalid terminal state');
      maxTurns = Math.max(maxTurns, turns); games++;
      const winner = pointSevensRanking(s)[0]; if (winner === s.finishOrder[0]) firstWins++; if (winner === s.finishOrder[3]) lastWins++;
      finalCards += s.penalties.reduce((a, b) => a + b, 0);
      const add = (c: ReturnType<typeof cell>, p: number) => { c.n++; c.score += s.scores[p]; c.wins += Number(p === winner); c.passes += s.passes[p]; };
      for (let p = 0; p < 4; p++) {
        const relative = (p - starter + 4) % 4; add(seat[relative], p);
        const mid = initial[p].filter(c => [3,4,10,11].includes(c.rank)).length;
        const midKey = mid <= 2 ? '0–2' : mid <= 4 ? '3–4' : '5以上'; add(middle[midKey], p);
        const sevenCount = initial[p].filter(c => c.rank === 7).length; add(sevens[sevenCount >= 2 ? '2以上' : String(sevenCount) as '0' | '1'], p);
        if (offset === 0) { add(actualSeat[relative], p); add(actualMiddle[midKey], p); }
        for (const card of initial[p]) { const c = rank[card.rank - 1]; add(c, p); c.credit += s.placements[card.id]?.points ?? -1; }
      }
      // 同一手札（本来の開始者）の、最初と最後の手番による点数差。
      starts.push(s.scores[base.turn]);
    }
    paired.push(starts[0] - starts[1]); // offset1では元の開始者が相対4番手になる。
  }
  const pairedMean = paired.reduce((a, b) => a + b, 0) / deals;
  const sd = deals > 1 ? Math.sqrt(paired.reduce((sum, v) => sum + (v - pairedMean) ** 2, 0) / (deals - 1)) : 0;
  results.push({ policy, games, deals, seat: seat.map(summary), actualDiamondStartSeat: actualSeat.map(summary), middle: Object.fromEntries(Object.entries(middle).map(([k, v]) => [k, summary(v)])), actualDiamondStartMiddle: Object.fromEntries(Object.entries(actualMiddle).map(([k, v]) => [k, summary(v)])), sevens: Object.fromEntries(Object.entries(sevens).map(([k, v]) => [k, summary(v)])), rank: rank.map((v, i) => ({ rank: i + 1, ...summary(v) })), pairedFirstMinusFourth: { mean: pairedMean, approximate95CI: [pairedMean - 1.96 * sd / Math.sqrt(deals), pairedMean + 1.96 * sd / Math.sqrt(deals)] }, onePoint, twoPoint, forced, voluntaryPasses, firstFinisherWinPercent: 100 * firstWins / games, lastPlayerWinPercent: 100 * lastWins / games, meanFinalCards: finalCards / games, maxTurns });
}
const report = { date: '2026-10-03', seed: 20261003, dealsPerPolicy: deals, policies, results };
writeFileSync(new URL('../docs/point-sevens-fairness.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
for (const r of results) console.log(JSON.stringify({ policy: r.policy, games: r.games, seat: r.seat, middle: r.middle, sevens: r.sevens, pairedFirstMinusFourth: r.pairedFirstMinusFourth, rankCredit: r.rank.map(v => ({ rank: v.rank, points: v.meanCardCredit })), voluntaryPasses: r.voluntaryPasses, firstFinisherWinPercent: r.firstFinisherWinPercent, lastPlayerWinPercent: r.lastPlayerWinPercent, maxTurns: r.maxTurns }));
