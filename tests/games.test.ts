import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemory, reveal, resolvePair, memoryMove } from '../src/memory.ts';
import { createOldMaid, nextPlayer, takeCard } from '../src/oldmaid.ts';
import { createUno, unoDeck, playUno, canPlay, drawCards, drawTurn, unoMove, passUno, type UnoState, type UnoCard } from '../src/uno.ts';
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const card = (id: number, kind: UnoCard['kind'], color: UnoCard['color'] = null, value?: number): UnoCard => ({ id, kind, color, value });
function state(): UnoState {
  return { ...createUno(false,seeded(1)), hands: [[card(1, 'number', 'red', 2)], [card(2, 'number', 'blue', 3)], [card(3, 'number', 'green', 4)], [card(4, 'number', 'yellow', 5)]], drawPile: Array.from({ length: 8 }, (_, i) => card(10 + i, 'number', 'blue', i)), discard: [card(0, 'number', 'red', 1)], color: 'red', topValue: 1, turn: 0, direction: 1, shields: [false, false, false, false], winner: null, tie: false, stalls: 0, drawnId: null, message: '' };
}
test('神経衰弱: 公開済み記憶でペアを選び、全24枚が終了する', () => {
  const s = createMemory(seeded(1));
  assert.equal(reveal(s, -1), false);
  let turns = 0;
  while (!s.done && turns++ < 400) {
    assert.ok(reveal(s, memoryMove(s, seeded(turns))));
    assert.ok(reveal(s, memoryMove(s, seeded(turns + 20))));
    assert.equal(reveal(s, 0), false);
    resolvePair(s);
  }
  assert.ok(s.done); assert.equal(s.scores[0] + s.scores[1], 12);
});
test('ババ抜き: 100通りの配札から終了し、ジョーカーだけが残る', () => {
  for (let seed = 0; seed < 100; seed++) {
    const random = seeded(seed), s = createOldMaid(random);
    let moves = 0;
    while (!s.done && moves++ < 5000) {
      const target = nextPlayer(s, s.turn);
      assert.ok(takeCard(s, Math.floor(random() * s.hands[target].length), random));
      for (const hand of s.hands) assert.equal(new Set(hand.map(c => c.rank)).size, hand.length);
    }
    assert.ok(s.done); assert.equal(s.hands.flat().length, 1); assert.equal(s.hands[s.loser!][0].rank, 0);
  }
});
test('UNO風: 独自カードのオン・オフとカード枚数', () => {
  assert.equal(unoDeck(false).length, 108); assert.equal(unoDeck(true).length, 114);
  assert.ok(unoDeck(false).every(c => !['swap', 'shield', 'all'].includes(c.kind)));
});
test('交換: 最後の1枚を出しても、交換後に手札があれば勝てない', () => {
  const s = state(); s.hands[0] = [card(1, 'swap')];
  assert.equal(playUno(s, 0, 'green', 0), false);
  assert.equal(playUno(s, 0, 'green', 1), true);
  assert.equal(s.hands[0].length, 1); assert.equal(s.hands[1].length, 0);
  assert.equal(s.winner, 1); assert.equal(s.color, 'green');
});
test('防御: ドローは防ぐが手番スキップは受け、1回で消費', () => {
  const s = state(); s.hands[0] = [card(1, 'draw2', 'red'), card(5, 'number', 'blue', 2)]; s.shields[1] = true;
  assert.ok(playUno(s, 0)); assert.equal(s.hands[1].length, 1); assert.equal(s.shields[1], false); assert.equal(s.turn, 2);
});
test('全員ドロー: 防御対象だけ免除され、手番は次の人', () => {
  const s = state(); s.hands[0] = [card(1, 'all'), card(5, 'number', 'blue', 2)]; s.shields[2] = true;
  assert.ok(playUno(s, 0, 'yellow'));
  assert.deepEqual(s.hands.map(h => h.length), [1, 2, 1, 2]); assert.equal(s.shields[2], false); assert.equal(s.turn, 1);
});
test('ドロー4: 現在色を持っていると出せない', () => {
  const s = state(); assert.equal(canPlay(card(1, 'draw4'), s.hands[0], s.discard[0], 'red'), false);
  assert.equal(canPlay(card(1, 'draw4'), s.hands[1], s.discard[0], 'red'), true);
});
test('山札枯渇: 最上段を残して再利用し、補充できない場合は引き分け', () => {
  const s = state(); s.drawPile = []; s.discard.push(card(5, 'number', 'blue', 7));
  assert.equal(drawCards(s, 0, 3, seeded(2)).length, 1); assert.equal(s.discard[0].id, 5);
  s.discard = [card(6, 'number', 'red', 9)]; s.topValue=9; s.hands[0] = [card(7, 'number', 'blue', 6)];
  for (let i = 0; i < 4; i++) drawTurn(s);
  assert.equal(s.tie, true);
});
test('山札が空でも出せるカードがあれば引き分けにしない', () => {
  const s = state(); s.drawPile = []; s.stalls = 3;
  assert.equal(drawTurn(s), false); assert.equal(s.tie, false); assert.equal(s.turn, 0); assert.equal(s.stalls, 0);
});
test('リバースとスキップは方向に従って手番を進める', () => {
  const s = state(); s.hands[0] = [card(1, 'reverse', 'red'), card(5, 'number', 'red', 3)];
  assert.ok(playUno(s, 0)); assert.equal(s.direction, -1); assert.equal(s.turn, 3);
  s.hands[3] = [card(4, 'skip', 'red'), card(6, 'number', 'red', 4)];
  assert.ok(playUno(s, 0)); assert.equal(s.turn, 1);
});
test('引いたカード: 他の手札は出せず、出すか終了を選べる', () => {
  const s = state(); s.drawPile = [card(9, 'number', 'red', 7)];
  assert.ok(drawTurn(s)); assert.equal(s.drawnId, 9); assert.equal(playUno(s, 0), false);
  assert.ok(passUno(s)); assert.equal(s.turn, 1); assert.equal(s.drawnId, null);
});
test('UNO風: 100対戦で合法手・カード総数・終了を確認', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = seeded(seed), s = createUno(seed % 2 === 0, random), total = seed % 2 === 0 ? 114 : 108;
    let moves = 0;
    while (s.winner === null && !s.tie && moves++ < 20000) {
      const choice = unoMove(s.hands[s.turn], s.discard.at(-1)!, s.color, s.hands.map(h => h.length), s.turn, s.drawnId);
      if (choice.index === undefined) assert.ok(s.drawnId === null ? drawTurn(s, random) : passUno(s));
      else assert.ok(playUno(s, choice.index, choice.color, choice.target, random));
      const all = [...s.hands.flat(), ...s.drawPile, ...s.discard];
      assert.equal(all.length, total); assert.equal(new Set(all.map(c => c.id)).size, total);
    }
    assert.ok(s.winner !== null || s.tie, `seed ${seed} did not finish`);
    if (s.winner !== null) assert.equal(s.hands[s.winner].length, 0);
  }
});
