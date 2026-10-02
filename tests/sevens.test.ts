import test from 'node:test';
import assert from 'node:assert/strict';
import { deck } from '../src/common.ts';
import { createSevens, canPlaceSevens, playSevens, passSevens, sevensMove, type SevensState } from '../src/sevens.ts';
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function cards(...ids: string[]) { return ids.map(id => deck().find(c => c.id === id)!); }
function state(hands: string[][]): SevensState { return { hands: hands.map(h => cards(...h)), board: cards('♠7', '♥7', '♦7', '♣7'), turn: 0, passes: [0, 0, 0, 0], ranks: [null, null, null, null], outcomes: ['playing', 'playing', 'playing', 'playing'], done: false, message: '' }; }
test('配札: 7を自動配置、♦7の元の持ち主から開始、全52枚保存', () => {
  const random = seeded(17), s = createSevens(random);
  const reference = deck(); const rng = seeded(17);
  for (let i = reference.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [reference[i], reference[j]] = [reference[j], reference[i]]; }
  assert.equal(s.turn, reference.findIndex(c => c.id === '♦7') % 4);
  assert.deepEqual(s.board.map(c => c.rank), [7, 7, 7, 7]);
  assert.ok(s.hands.flat().every(c => c.rank !== 7));
  assert.equal(new Set([...s.hands.flat(), ...s.board].map(c => c.id)).size, 52);
  assert.deepEqual(s.hands.map(h => h.length + s.board.filter(c => reference.findIndex(r => r.id === c.id) % 4 === s.hands.indexOf(h)).length), [13, 13, 13, 13]);
});
test('隣接判定: 同マークのみ、重複不可、AとKはつながらない', () => {
  const board = cards('♠7', '♠6', '♥7', '♣1');
  for (const id of ['♠5', '♠8', '♥6', '♥8', '♣2']) assert.equal(canPlaceSevens(board, cards(id)[0]), true);
  for (const id of ['♠4', '♠7', '♦6', '♣13']) assert.equal(canPlaceSevens(board, cards(id)[0]), false);
});
test('不正な手札・出せないカード・終了後操作は無変更', () => {
  const s = state([['♠5', '♠6'], ['♥6'], ['♦6'], ['♣6']]); const before = structuredClone(s);
  assert.equal(playSevens(s, '♥6'), false); assert.equal(playSevens(s, '♠5'), false); assert.deepEqual(s, before);
  assert.equal(playSevens(s, '♠6'), true); assert.equal(s.turn, 1);
  s.done = true; const ended = structuredClone(s); assert.equal(passSevens(s), false); assert.equal(playSevens(s, '♥6'), false); assert.deepEqual(s, ended);
});
test('3回のパスでは残留、4回目で脱落・全手札配置・離れたカードの両隣を解禁', () => {
  const s = state([['♠3', '♠11'], ['♥6'], ['♦6'], ['♣6']]);
  for (let i = 1; i <= 3; i++) { s.turn = 0; assert.equal(passSevens(s), true); assert.equal(s.passes[0], i); assert.equal(s.outcomes[0], 'playing'); assert.equal(s.board.length, 4); }
  s.turn = 0; passSevens(s); assert.equal(s.ranks[0], 4); assert.equal(s.outcomes[0], 'dropped'); assert.equal(s.hands[0].length, 0); assert.equal(s.turn, 1);
  for (const id of ['♠2','♠4','♠10','♠12']) assert.ok(canPlaceSevens(s.board, cards(id)[0]));
  assert.equal(canPlaceSevens(s.board, cards('♠5')[0]), false);
});
test('出せるカードがあってもパス可能、あがった人・脱落者は手番を飛ばす', () => {
  const s = state([['♠6'], ['♥6'], ['♦6'], ['♣6']]);
  assert.equal(passSevens(s), true); assert.equal(s.passes[0], 1);
  assert.equal(playSevens(s, '♥6'), true); assert.equal(s.ranks[1], 1);
  s.passes[2] = 3; assert.equal(passSevens(s), true); assert.equal(s.ranks[2], 4);
  assert.equal(playSevens(s, '♣6'), true); assert.equal(s.ranks[3], 2);
  assert.equal(s.done, true); assert.equal(s.outcomes[0], 'last'); assert.equal(s.ranks[0], 3);
  assert.equal(s.hands[0].length, 1);
});
test('脱落が続くと下位から確定し、最後の人が1位', () => {
  const s = state([['♠6'], ['♥6'], ['♦6'], ['♣6']]); s.passes = [3, 3, 3, 0];
  passSevens(s); passSevens(s); passSevens(s);
  assert.deepEqual(s.ranks, [4, 3, 2, 1]); assert.equal(s.outcomes[3], 'last'); assert.ok(s.done);
});
test('AIは合法手を選び、自分の次のカードを開く手を優先する', () => {
  const board = cards('♠7','♥7','♦7','♣7'); const hand = cards('♠6','♠5','♥8');
  assert.equal(sevensMove(hand, board), '♠6'); assert.equal(sevensMove(cards('♠3'), board), null);
});
test('500対戦: AIと任意パスでも終了し、カード保存・合法手・順位一意性を維持', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const rng = seeded(seed), s = createSevens(rng); let steps = 0;
    while (!s.done && steps++ < 100) {
      assert.equal(s.outcomes[s.turn], 'playing'); assert.ok(s.hands[s.turn].length > 0);
      const id = sevensMove(s.hands[s.turn], s.board);
      if (id && rng() > .2) { assert.ok(canPlaceSevens(s.board, cards(id)[0])); assert.ok(playSevens(s, id)); } else assert.ok(passSevens(s));
      const all = [...s.hands.flat(), ...s.board]; assert.equal(all.length, 52); assert.equal(new Set(all.map(c => c.id)).size, 52);
      assert.ok(s.passes.every(p => p <= 4));
      assert.equal(new Set(s.ranks.filter(r => r !== null)).size, s.ranks.filter(r => r !== null).length);
    }
    assert.ok(s.done); assert.deepEqual([...s.ranks].sort(), [1, 2, 3, 4]);
    assert.equal(s.outcomes.filter(o => o === 'last').length, 1);
  }
});
