import test from 'node:test';
import assert from 'node:assert/strict';
import { deck } from '../src/common.ts';
import { createDaifugo, nextRound, playDaifugo, passDaifugo, canPlayDaifugo, exchangeCards, daifugoMove, strength, type DaifugoState } from '../src/daifugo.ts';
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function cards(...ids: string[]) { return ids.map(id => deck().find(c => c.id === id)!); }
function state(hands: string[][]): DaifugoState {
  return { hands: hands.map(h => cards(...h)), table: [], spent: [], retired: [], turn: 0, leader: null, passed: [false, false, false, false], revolution: false, order: [], previousOrder: [], fallen: null, round: 1, phase: 'play', exchangeCount: 0, message: '' };
}
test('配札: 52枚を13枚ずつ配り、ダイヤ3の持ち主から開始', () => {
  const s = createDaifugo(seeded(1));
  assert.deepEqual(s.hands.map(h => h.length), [13, 13, 13, 13]);
  assert.equal(new Set(s.hands.flat().map(c => c.id)).size, 52);
  assert.ok(s.hands[s.turn].some(c => c.id === '♦3'));
  assert.ok(strength(2) > strength(1)); assert.ok(strength(1) > strength(13));
});
test('合法手: 同数字・同枚数・強さ・所持・重複を検査', () => {
  const s = state([['♠3', '♥3', '♠4', '♥4', '♠2'], ['♦5'], ['♣6'], ['♦7']]);
  s.table = cards('♦3', '♣3');
  assert.equal(canPlayDaifugo(s, s.hands[0], ['♠4', '♥4']), true);
  for (const ids of [[], ['♠4'], ['♠3', '♥3'], ['♠3', '♠4'], ['♠4', '♠4'], ['♦2', '♥2']]) assert.equal(canPlayDaifugo(s, s.hands[0], ids), false);
  s.revolution = true; s.table = cards('♦4', '♣4');
  assert.equal(canPlayDaifugo(s, s.hands[0], ['♠3', '♥3']), true);
});
test('革命と再革命、4枚の8で革命と8切りが同時発動', () => {
  const s = state([['♠7', '♥7', '♦7', '♣7', '♠5'], ['♠4', '♥4', '♦4', '♣4', '♥5'], ['♠9'], ['♥9']]);
  assert.ok(playDaifugo(s, ['♠7', '♥7', '♦7', '♣7'])); assert.equal(s.revolution, true);
  assert.ok(playDaifugo(s, ['♠4', '♥4', '♦4', '♣4'])); assert.equal(s.revolution, false);
  const eight = state([['♠8', '♥8', '♦8', '♣8', '♠5'], ['♠9'], ['♥9'], ['♦9']]);
  assert.ok(playDaifugo(eight, ['♠8', '♥8', '♦8', '♣8']));
  assert.equal(eight.revolution, true); assert.equal(eight.table.length, 0); assert.equal(eight.turn, 0);
});
test('パス: 場が流れるまで復帰せず、最後の出し手が再開', () => {
  const s = state([['♠3', '♠6'], ['♠4', '♠7'], ['♠5', '♠8'], ['♠9', '♠10']]);
  assert.equal(passDaifugo(s), false);
  assert.ok(playDaifugo(s, ['♠3'])); assert.ok(passDaifugo(s));
  assert.ok(playDaifugo(s, ['♠5'])); assert.ok(passDaifugo(s)); assert.ok(passDaifugo(s));
  assert.equal(s.table.length, 0); assert.equal(s.turn, 2); assert.deepEqual(s.passed, [false, false, false, false]);
});
test('最後の出し手があがった場合、全員パス後に次の未終了者から再開', () => {
  const s = state([['♠2'], ['♠3', '♠4'], ['♠5', '♠6'], ['♠7', '♠9']]);
  assert.ok(playDaifugo(s, ['♠2'])); assert.deepEqual(s.order, [0]);
  for (let i = 0; i < 3; i++) assert.ok(passDaifugo(s));
  assert.equal(s.turn, 1); assert.equal(s.table.length, 0);
});
test('8切りであがる場合は次の未終了者の手番', () => {
  const s = state([['♠8'], ['♠3'], ['♠4'], ['♠5']]);
  assert.ok(playDaifugo(s, ['♠8'])); assert.equal(s.turn, 1); assert.equal(s.table.length, 0);
});
test('都落ち: 前回大富豪は最下位固定、手札を退避して残りの順位を決める', () => {
  const s = state([['♠3'], ['♠4', '♠5'], ['♠6'], ['♠7']]); s.previousOrder = [1, 0, 2, 3];
  assert.ok(playDaifugo(s, ['♠3'])); assert.equal(s.fallen, 1); assert.equal(s.retired.length, 2); assert.equal(s.turn, 2);
  assert.ok(playDaifugo(s, ['♠6'])); assert.deepEqual(s.order, [0, 2, 3, 1]); assert.equal(s.phase, 'done');
  assert.equal(playDaifugo(s, ['♠7']), false); assert.equal(passDaifugo(s), false);
});
test('前回大富豪が最初にあがれば都落ちなし', () => {
  const s = state([['♠3'], ['♠4'], ['♠5'], ['♠6']]); s.previousOrder = [0, 1, 2, 3];
  assert.ok(playDaifugo(s, ['♠3'])); assert.equal(s.fallen, null);
});
test('交換: 上位の任意選択と下位の最強カードを同時に渡す', () => {
  const s = state([['♠3', '♠4', '♠2'], ['♥3', '♥4', '♥2'], ['♦3', '♦4', '♦2'], ['♣3', '♣1', '♣2']]);
  s.previousOrder = [0, 1, 2, 3]; s.phase = 'exchange'; s.exchangeCount = 2;
  assert.equal(exchangeCards(s, ['♠3']), false); assert.equal(exchangeCards(s, ['♠3', '♠3']), false);
  assert.ok(exchangeCards(s, ['♠3', '♠4']));
  assert.deepEqual(new Set(s.hands[0].map(c => c.id)), new Set(['♠2', '♣1', '♣2']));
  assert.deepEqual(new Set(s.hands[3].map(c => c.id)), new Set(['♣3', '♠3', '♠4']));
  assert.ok(s.hands[1].some(c => c.id === '♦2')); assert.ok(s.hands[2].some(c => c.id === '♥3'));
  assert.equal(s.turn, 3); assert.equal(s.phase, 'play'); assert.equal(exchangeCards(s, ['♣1', '♣2']), false);
});
test('次ラウンド: 革命とパスをリセットし、上位なら交換待ち・下位なら自動交換', () => {
  const s = createDaifugo(seeded(1)); s.phase = 'done'; s.order = [0, 1, 2, 3]; s.revolution = true;
  const next = nextRound(s, seeded(2)); assert.equal(next.round, 2); assert.equal(next.phase, 'exchange'); assert.equal(next.exchangeCount, 2); assert.equal(next.revolution, false);
  assert.deepEqual(next.passed, [false, false, false, false]);
  const lower = createDaifugo(seeded(3), [1, 2, 3, 0], 2); assert.equal(lower.phase, 'play'); assert.equal(lower.turn, 0);
  const second = createDaifugo(seeded(4), [1, 0, 2, 3], 2); assert.equal(second.exchangeCount, 1);
});
test('AI: 200配札×5ラウンドで合法手・カード保存・終了・順位の一意性', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const random = seeded(seed); let s = createDaifugo(random);
    for (let round = 1; round <= 5; round++) {
      if (s.phase === 'exchange') assert.ok(exchangeCards(s, s.hands[0].slice(0, s.exchangeCount).map(c => c.id)));
      let moves = 0;
      while (s.phase === 'play' && moves++ < 1000) {
        const ids = daifugoMove(s.hands[s.turn], s.table, s.revolution);
        assert.ok(ids.length ? playDaifugo(s, ids) : passDaifugo(s), `seed=${seed} round=${round} move=${moves}`);
        const all = [...s.hands.flat(), ...s.spent, ...s.retired];
        assert.equal(all.length, 52); assert.equal(new Set(all.map(c => c.id)).size, 52);
        if (s.phase === 'play') { assert.ok(s.hands[s.turn].length); assert.ok(!s.order.includes(s.turn)); assert.notEqual(s.turn, s.fallen); assert.equal(s.passed[s.turn], false); }
      }
      assert.equal(s.phase, 'done', `seed=${seed} round=${round}`);
      assert.equal(s.order.length, 4); assert.equal(new Set(s.order).size, 4);
      if (s.fallen !== null) assert.equal(s.order[3], s.fallen);
      if (round < 5) s = nextRound(s, random);
    }
  }
});
