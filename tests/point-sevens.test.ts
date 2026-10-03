import test from 'node:test';
import assert from 'node:assert/strict';
import { deck, type PlayingCard } from '../src/common.ts';
import { createPointSevens, pointSevensValue, canPassPointSevens, playPointSevens, passPointSevens, pointSevensMove, pointSevensRanking, type PointSevensState } from '../src/point-sevens.ts';
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function cards(...ids: string[]) { return ids.map(id => deck().find(c => c.id === id)!); }
function state(hands: string[][]): PointSevensState { return { ...createPointSevens(seeded(1)), hands: hands.map(h => cards(...h)), board: cards('♠7','♥7','♦7','♣7'), turn: 0, scores: [0,0,0,0], passes: [0,0,0,0], penalties: [0,0,0,0], finishOrder: [], phase: 'play', consecutivePasses: 0, forced: false, lastPassBoardSize: [-1,-1,-1,-1], placements: {}, message: '' }; }
function referenceValue(board: PlayingCard[], card: PlayingCard) {
  if (board.some(c => c.id === card.id)) return 0;
  const same = board.filter(c => c.suit === card.suit);
  if (![1,13].includes(card.rank) && !same.some(c => Math.abs(c.rank-card.rank)===1)) return 0;
  const ranks = new Set([...same.map(c=>c.rank),card.rank]), reached = new Set<number>();
  const stack=[7]; while(stack.length){const rank=stack.pop()!; if(reached.has(rank)||!ranks.has(rank))continue;reached.add(rank);if(rank>1)stack.push(rank-1);if(rank<13)stack.push(rank+1);}
  return reached.has(card.rank)?2:1;
}
test('配札: 初期7の所有者に各2点、52枚保存、♦7所有者が開始', () => {
  const s=createPointSevens(seeded(17)); assert.equal(s.board.length,4);assert.equal(s.scores.reduce((a,b)=>a+b),8);
  assert.equal(s.placements['♦7'].player,s.turn);
  for(let p=0;p<4;p++) {const sevens=Object.values(s.placements).filter(v=>v.player===p);assert.equal(s.hands[p].length+sevens.length,13);assert.equal(s.scores[p],sevens.length*2);}
  assert.equal(new Set([...s.board,...s.hands.flat()].map(c=>c.id)).size,52);
});
test('得点: 7側2点、A/K起点1点、未接続1点、接続する穴2点、過去の得点不変',()=>{
  const s=state([['♠1','♠2','♠6'],['♥1','♥6'],['♦13','♦6'],['♣13','♣6']]);
  assert.equal(pointSevensValue(s.board,cards('♠1')[0]),1);assert.equal(pointSevensValue(s.board,cards('♦13')[0]),1);assert.equal(pointSevensValue(s.board,cards('♠6')[0]),2);assert.equal(pointSevensValue(s.board,cards('♠4')[0]),0);
  playPointSevens(s,'♠1');s.turn=0;playPointSevens(s,'♠2');assert.equal(s.scores[0],2);
  s.board.push(...cards('♠3','♠4','♠5'));s.turn=0;playPointSevens(s,'♠6');assert.equal(s.scores[0],4);assert.equal(s.placements['♠1'].points,1);assert.equal(s.placements['♠2'].points,1);
  assert.equal(pointSevensValue(cards('♠1','♠7'),cards('♠12')[0]),0);
});
test('全員パスで強制配置、出せない人だけパス可、配置で解除',()=>{
  const s=state([['♠3'],['♥6','♥5'],['♦6'],['♣6']]);
  for(let i=0;i<4;i++)assert.ok(passPointSevens(s));assert.ok(s.forced);assert.equal(s.turn,0);assert.deepEqual(s.scores,[-1,-1,-1,-1]);
  assert.ok(canPassPointSevens(s));passPointSevens(s);assert.equal(s.turn,1);assert.equal(canPassPointSevens(s),false);
  const before=structuredClone(s);assert.equal(passPointSevens(s),false);assert.deepEqual(s,before);
  playPointSevens(s,'♥6');assert.equal(s.forced,false);assert.equal(s.consecutivePasses,0);assert.equal(s.scores[1],1);
});
test('あがった人を除外した人数でパス1周を数える',()=>{
  const s=state([[],['♥6','♥5'],['♦6','♦5'],['♣6','♣5']]);s.finishOrder=[0];s.turn=1;
  passPointSevens(s);passPointSevens(s);assert.equal(s.forced,false);passPointSevens(s);assert.ok(s.forced);assert.equal(s.turn,1);
});
test('最後の1人に最終1手、配置後に残枚数減点、二重処理不可',()=>{
  const s=state([['♠6'],['♥6','♥5','♥4'],[],[]]);s.finishOrder=[2,3];
  playPointSevens(s,'♠6');assert.equal(s.phase,'final');assert.equal(s.turn,1);assert.ok(s.forced);assert.equal(canPassPointSevens(s),false);
  assert.equal(passPointSevens(s),false);playPointSevens(s,'♥6');assert.equal(s.phase,'done');assert.equal(s.scores[1],0);assert.equal(s.penalties[1],2);assert.equal(s.hands[1].length,2);assert.deepEqual(s.finishOrder,[2,3,0,1]);
  const before=structuredClone(s);assert.equal(playPointSevens(s,'♥5'),false);assert.equal(passPointSevens(s),false);assert.deepEqual(s,before);
});
test('最終1手で手札が空になる場合は残枚数減点0',()=>{
  const s=state([['♠6'],['♥6'],[],[]]);s.finishOrder=[2,3];playPointSevens(s,'♠6');playPointSevens(s,'♥6');assert.equal(s.penalties[1],0);assert.equal(s.scores[1],2);assert.equal(s.finishOrder.length,4);
});
test('得点順位はあがり順と別、同点のみあがり順',()=>{
  const s=state([[],[],[],[]]);s.scores=[12,20,20,5];s.finishOrder=[0,2,1,3];s.phase='done';assert.deepEqual(pointSevensRanking(s),[2,1,0,3]);
});
test('不所持・不正配置は無変更、AIは強制配置を守り同盤面で再度戦略パスしない',()=>{
  const s=state([['♠3'],['♥6'],['♦6'],['♣6']]);const before=structuredClone(s);assert.equal(playPointSevens(s,'♥6'),false);assert.equal(playPointSevens(s,'♠3'),false);assert.deepEqual(s,before);
  const hand=cards('♠4','♠5','♥3','♦10'),board=cards('♠1','♠2','♠3','♠7','♥7','♦7','♣7');
  assert.equal(pointSevensMove(hand,board,{forced:false,lastPassBoardSize:-1}),null);
  assert.equal(pointSevensMove(hand,board,{forced:true,lastPassBoardSize:-1}),'♠4');
  assert.equal(pointSevensMove(hand,board,{forced:false,lastPassBoardSize:board.length}),'♠4');
});
test('常時パスを試みても強制配置で全対戦が終了する',()=>{
  for(let seed=1;seed<=100;seed++){
    const s=createPointSevens(seeded(seed));let steps=0;
    while(s.phase!=='done'&&steps++<1600){if(canPassPointSevens(s))passPointSevens(s);else {const c=s.hands[s.turn].find(c=>pointSevensValue(s.board,c)>0);assert.ok(c);playPointSevens(s,c.id);}}
    assert.equal(s.phase,'done');assert.equal(s.finishOrder.length,4);
  }
});
test('500対戦: 別の連結探索で採点照合、カード保存、得点内訳、最終手番、終了',()=>{
  for(let seed=1;seed<=500;seed++){
    const rng=seeded(seed),s=createPointSevens(rng);let steps=0,finalMoves=0;
    while(s.phase!=='done'&&steps++<1600){
      const p=s.turn;assert.ok(!s.finishOrder.includes(p));
      for(const card of s.hands[p])assert.equal(pointSevensValue(s.board,card),referenceValue(s.board,card));
      const id=pointSevensMove(s.hands[p],s.board,{forced:s.forced,lastPassBoardSize:s.lastPassBoardSize[p]});
      if(s.phase==='final')finalMoves++;
      if(canPassPointSevens(s)&&rng()<.15||!id)assert.ok(passPointSevens(s));else assert.ok(playPointSevens(s,id));
      const all=[...s.board,...s.hands.flat()];assert.equal(all.length,52);assert.equal(new Set(all.map(c=>c.id)).size,52);
      for(let i=0;i<4;i++)assert.equal(s.scores[i],Object.values(s.placements).filter(v=>v.player===i).reduce((sum,v)=>sum+v.points,0)-s.passes[i]+s.freePasses[i]-s.penalties[i]+s.bonuses[i]);
    }
    assert.equal(s.phase,'done');assert.equal(finalMoves,1);assert.equal(new Set(s.finishOrder).size,4);assert.equal(s.hands[s.finishOrder[3]].length,s.penalties[s.finishOrder[3]]);
  }
});
