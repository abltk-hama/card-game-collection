import test from 'node:test';
import assert from 'node:assert/strict';
import { deck, shuffle, type PlayingCard } from '../src/common.ts';
import { analyseGin, defendGin, scoreGin, createGin, drawGin, declineGin, discardGin, nextGinRound, chooseGinDiscard, shouldTakeGinDiscard, type GinState } from '../src/gin.ts';
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function cards(...ids: string[]): PlayingCard[] { return ids.map(id => { const c = deck().find(c => c.id === id); assert.ok(c, id); return c; }); }
const core = ['♠1', '♠2', '♠3', '♥5', '♥6', '♥7', '♣10', '♦10', '♠10'];
const opponentIds = ['♦1', '♦3', '♦5', '♦7', '♦9', '♦11', '♣4', '♣6', '♣8', '♣12'];
function state(hand: string[], opponent = opponentIds, player = 0): GinState {
  const s = createGin(seeded(1), 1);
  s.hands = player === 0 ? [cards(...hand), cards(...opponent)] : [cards(...opponent), cards(...hand)];
  s.turn = player; s.phase = 'discard'; s.stock = cards('♦13', '♣13', '♥13'); s.discard = cards('♥12'); return s;
}
test('組: Aは低位、Q-K-A不可、同数字3〜4枚、長い連番に対応', () => {
  assert.equal(analyseGin(cards('♠1', '♠2', '♠3')).points, 0);
  assert.equal(analyseGin(cards('♠12', '♠13', '♠1')).points, 21);
  assert.equal(analyseGin(cards('♠7', '♥7', '♦7', '♣7')).points, 0);
  assert.equal(analyseGin(cards('♥4', '♥5', '♥6', '♥7', '♥8', '♥9')).points, 0);
  assert.equal(analyseGin(cards('♥4', '♦5', '♥6')).points, 15);
});
test('組が重なる手札でもカードを共有せず最小の残り点数を選ぶ', () => {
  const hand = cards('♠3', '♠4', '♠5', '♠6', '♥5', '♦5', '♣5', '♣10', '♦11', '♥12');
  const a = analyseGin(hand);
  assert.equal(a.points, 30);
  const covered = [...a.melds.flat(), ...a.deadwood];
  assert.equal(covered.length, 10); assert.equal(new Set(covered.map(c => c.id)).size, 10);
});
test('自動判定の点数を独立した全部分集合の探索と照合する', () => {
  function reference(hand: PlayingCard[]): number {
    const valid: number[] = [];
    for (let mask = 1; mask < 1 << hand.length; mask++) {
      const selected = hand.filter((_, i) => mask & 1 << i).sort((a, b) => a.rank - b.rank);
      if (selected.length < 3) continue;
      if (selected.length <= 4 && selected.every(c => c.rank === selected[0].rank) || selected.every((c, i) => c.suit === selected[0].suit && (!i || c.rank === selected[i - 1].rank + 1))) valid.push(mask);
    }
    const memo = new Map<number, number>();
    function solve(mask: number): number {
      if (memo.has(mask)) return memo.get(mask)!;
      let points = hand.reduce((total, c, i) => total + (mask & 1 << i ? Math.min(c.rank, 10) : 0), 0);
      for (const meld of valid) if ((meld & mask) === meld) points = Math.min(points, solve(mask ^ meld));
      memo.set(mask, points); return points;
    }
    return solve((1 << hand.length) - 1);
  }
  for (let seed = 1; seed <= 150; seed++) {
    const hand = shuffle(deck(), seeded(seed)).slice(0, seed % 2 ? 10 : 11);
    assert.equal(analyseGin(hand).points, reference(hand));
  }
});
test('付け札: 連鎖を処理し、自己メルドの最小点より良い配置を選べる', () => {
  const own = analyseGin(cards(...core, '♣2'));
  const opponent = cards('♥8', '♥9', '♠8', '♦8', '♣8', '♣4', '♣5', '♣6', '♦2', '♠4');
  const defense = defendGin(opponent, own.melds);
  assert.equal(analyseGin(opponent).points, 15);
  assert.equal(defense.analysis.points, 2);
  assert.deepEqual(new Set(defense.laidOff.map(l => l.card.id)), new Set(['♥8', '♥9', '♠4']));
  assert.ok(defense.laidOff.findIndex(l => l.card.id === '♥8') < defense.laidOff.findIndex(l => l.card.id === '♥9'));
  assert.equal(defense.analysis.melds.flat().length + defense.analysis.deadwood.length + defense.laidOff.length, 10);
  const scored = scoreGin(cards(...core, '♣2'), opponent);
  assert.equal(scored.kind, 'undercut'); assert.equal(scored.points, 25); assert.equal(scored.winner, 1);
});
test('付け札: 同数字の組の4枚目と連番の両端に付けられる', () => {
  const targets = [cards('♠9', '♥9', '♦9'), cards('♣4', '♣5', '♣6')];
  const result = defendGin(cards('♣9', '♣3', '♣7', '♣8', '♦12'), targets);
  assert.equal(result.analysis.points, 10); assert.equal(result.laidOff.length, 4);
});
test('得点: ノック成功の差分・ジン25点・ジンには付け札不可', () => {
  const knock = scoreGin(cards(...core, '♣2'), cards(...opponentIds));
  assert.equal(knock.kind, 'knock'); assert.equal(knock.points, 61);
  const gin = scoreGin(cards(...core, '♥8'), cards('♥9', '♥10', '♥11', '♣3', '♣4', '♣5', '♦4', '♦6', '♦8', '♦12'));
  assert.equal(gin.kind, 'gin'); assert.equal(gin.laidOff.length, 0);
  assert.equal(gin.points, gin.analyses[1].points + 25);
});
test('開始時: 両者見送り後は非ディーラーが山札から引く', () => {
  const s = createGin(seeded(2), 1);
  assert.equal(s.turn, 0); assert.equal(s.stock.length, 31);
  assert.equal(drawGin(s, 'stock'), false);
  assert.ok(declineGin(s)); assert.equal(s.turn, 1);
  assert.ok(declineGin(s)); assert.equal(s.turn, 0); assert.equal(s.phase, 'draw');
  assert.equal(drawGin(s, 'discard'), false); assert.ok(drawGin(s, 'stock'));
  assert.equal(s.hands[0].length, 11); assert.equal(s.stock.length, 30);
});
test('捨て札から取ったカードは同じ手番に捨て直せず、AIも選ばない', () => {
  const s = createGin(seeded(3), 1), upcard = s.discard.at(-1)!;
  assert.ok(drawGin(s, 'discard')); assert.equal(s.phase, 'discard');
  assert.equal(discardGin(s, upcard.id), false); assert.equal(drawGin(s, 'stock'), false);
  const move = chooseGinDiscard(s.hands[0], s.forbiddenDiscard);
  assert.notEqual(move.id, upcard.id); assert.ok(discardGin(s, move.id));
  assert.equal(s.forbiddenDiscard, null); assert.equal(s.hands[0].length, 10);
});
test('ノックの10点境界、不正操作で手札や得点を変更しない', () => {
  const ten = state([...core, '♣12', '♣13']);
  assert.ok(discardGin(ten, '♣13', true)); assert.equal(ten.result!.analyses[0].points, 10);
  const eleven = state(['♠1', '♠2', '♠3', '♥5', '♥6', '♥7', '♣10', '♦10', '♦1', '♠12', '♣13']);
  const before = JSON.stringify(eleven);
  assert.equal(discardGin(eleven, '♣13', true), false); assert.equal(JSON.stringify(eleven), before);
  assert.equal(discardGin(eleven, 'not-held'), false);
});
test('100点到達で対戦終了、AI側がノックした場合も得点と手札表示の対応は正しい', () => {
  const s = state([...core, '♥8', '♣13'], opponentIds, 1); s.scores = [0, 90];
  assert.ok(discardGin(s, '♣13', true)); assert.equal(s.phase, 'matchOver'); assert.equal(s.result!.winner, 1);
  assert.equal(s.result!.analyses[1].points, 0); assert.equal(s.result!.analyses[0].points, 63);
  assert.equal(s.scores[1], 178); assert.equal(drawGin(s, 'stock'), false);
  assert.throws(() => nextGinRound(s));
});
test('山札2枚の手番: ノックが優先、通常捨てなら無得点・同じ配り手で再開', () => {
  const s = state([...core, '♣2', '♣13']); s.stock = cards('♦13', '♥13');
  assert.ok(discardGin(s, '♣13')); assert.equal(s.result!.kind, 'draw'); assert.deepEqual(s.scores, [0, 0]);
  const next = nextGinRound(s, seeded(4)); assert.equal(next.dealer, s.dealer); assert.equal(next.round, 2);
  const knocked = state([...core, '♣2', '♣13']); knocked.stock = cards('♦13', '♥13');
  assert.ok(discardGin(knocked, '♣13', true)); assert.equal(knocked.result!.kind, 'knock');
  assert.equal(nextGinRound(knocked, seeded(5)).dealer, 1 - knocked.dealer);
});
test('AI対戦100通り: 各手の合法性・52枚保存・ラウンド終了・100点到達', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = seeded(seed); let s = createGin(random), rounds = 0;
    while (s.phase !== 'matchOver' && rounds++ < 100) {
      let moves = 0;
      while (!['roundOver', 'matchOver'].includes(s.phase) && moves++ < 200) {
        const hand = s.hands[s.turn];
        if (s.phase === 'discard') { const move = chooseGinDiscard(hand, s.forbiddenDiscard); assert.ok(discardGin(s, move.id, move.points <= 10)); }
        else if (s.phase === 'opening') assert.ok(shouldTakeGinDiscard(hand, s.discard.at(-1)!) ? drawGin(s, 'discard') : declineGin(s));
        else assert.ok(drawGin(s, !s.mustStock && s.discard.length && shouldTakeGinDiscard(hand, s.discard.at(-1)!) ? 'discard' : 'stock'));
        const all = [...s.hands.flat(), ...s.stock, ...s.discard];
        assert.equal(all.length, 52); assert.equal(new Set(all.map(c => c.id)).size, 52);
        assert.equal(s.hands[1 - s.turn].length, 10);
        assert.equal(s.hands[s.turn].length, s.phase === 'discard' ? 11 : 10);
      }
      assert.ok(['roundOver', 'matchOver'].includes(s.phase), `seed=${seed} round=${rounds}`);
      if (s.phase === 'roundOver') s = nextGinRound(s, random);
    }
    assert.equal(s.phase, 'matchOver', `seed=${seed}`); assert.ok(s.scores.some(score => score >= 100));
  }
});
