import test from 'node:test';
import assert from 'node:assert/strict';
import { deck } from '../src/common.ts';
import { createPointSevens, nextPointSevensRound, pointSpecialKinds, choosePointSpecial, canUsePointSpecial, usePointSpecial, pointSevensValue, playPointSevens, passPointSevens, endPointSevensTurn, skipPointInterrupt, pointSevensMove, pointSpecialMove, pointBonusChoice, pointSevensRanking, type PointSevensState, type PointSpecialKind } from '../src/point-sevens.ts';
function seeded(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function cards(...ids:string[]){return ids.map(id=>deck().find(c=>c.id===id)!);}
function state(hands:string[][]):PointSevensState{return {...createPointSevens(seeded(1)),hands:hands.map(h=>cards(...h)),board:cards('♠7','♥7','♦7','♣7'),turn:0,scores:[0,0,0,0],placements:{},specials:[[],[],[],[]]};}
function special(s:PointSevensState,p:number,kind:PointSpecialKind){const id=`${p}:${kind}:${s.specials[p].length}`;s.specials[p].push({id,kind});return id;}
test('配布と次ラウンド: 各1枚・最下位だけ追加選択・累計・得点反転リセット',()=>{
  const s=createPointSevens(seeded(5));assert.ok(s.specials.every(h=>h.length===1));assert.equal(new Set(s.specials.flat().map(c=>c.id)).size,4);
  s.scores=[5,2,8,4];s.finishOrder=[0,3,1,2];s.totals=[15,12,18,14];s.phase='done';s.inverted=true;
  const n=nextPointSevensRound(s,seeded(6));assert.equal(n.bonusOwner,1);assert.equal(n.phase,'choice');assert.equal(n.round,2);assert.deepEqual(n.totals,s.totals);assert.equal(n.inverted,false);
  const before=structuredClone(n);assert.equal(playPointSevens(n,n.hands[1][0].id),false);assert.equal(passPointSevens(n),false);assert.deepEqual(n,before);
  assert.ok(choosePointSpecial(n,'gift'));assert.equal(n.specials[1].length,2);assert.equal(n.turn,n.placements['♦7'].player);assert.equal(n.phase,'play');assert.equal(choosePointSpecial(n,'force'),false);
});
test('反転は全員に適用、再使用で復帰、初期点・既存配置点は不変',()=>{
  const s=state([['♠6','♠1'],['♥6','♥1'],['♦6'],['♣6']]);const a=special(s,0,'flip'),b=special(s,1,'flip');
  usePointSpecial(s,a);assert.equal(s.inverted,true);assert.equal(s.turn,1);assert.equal(pointSevensValue(s.board,cards('♥6')[0],s.inverted),1);assert.equal(pointSevensValue(s.board,cards('♥1')[0],s.inverted),2);
  playPointSevens(s,'♥6');assert.equal(s.scores[1],1);s.turn=1;usePointSpecial(s,b);assert.equal(s.inverted,false);assert.equal(s.scores[1],1);assert.equal(s.placements['♥6'].points,1);
});
test('指定配置: 離れた空きへ即配置・本人に2点・即あがり・自分指定可',()=>{
  const s=state([['♠6','♠3'],['♥3'],['♦6'],['♣6']]);s.inverted=true;const id=special(s,0,'force');
  assert.ok(usePointSpecial(s,id,{cardId:'♥3'}));assert.equal(s.scores[1],2);assert.ok(s.board.some(c=>c.id==='♥3'));assert.deepEqual(s.finishOrder,[1]);assert.equal(s.turn,2);assert.equal(pointSevensValue(s.board,cards('♥2')[0],s.inverted),2);
  s.turn=0;const own=special(s,0,'force');usePointSpecial(s,own,{cardId:'♠3'});assert.equal(s.scores[0],2);assert.equal(s.hands[0].length,1);
});
test('予約の次手番に最大2枚、1枚目で解禁・採点、手番途中の特殊・パス不可',()=>{
  const s=state([['♠6','♠5','♠3'],['♥6','♥5'],['♦6','♦5'],['♣6','♣5']]);const id=special(s,0,'double');special(s,0,'flip');
  usePointSpecial(s,id);assert.equal(s.turn,1);assert.equal(s.doubleReady[0],true);assert.equal(s.board.length,4);
  playPointSevens(s,'♥6');playPointSevens(s,'♦6');playPointSevens(s,'♣6');assert.equal(s.turn,0);assert.equal(s.remainingPlays,2);assert.equal(s.doubleReady[0],false);
  playPointSevens(s,'♠6');assert.equal(s.turn,0);assert.equal(s.remainingPlays,1);assert.equal(canUsePointSpecial(s,s.specials[0][0].id),false);assert.equal(passPointSevens(s),false);
  playPointSevens(s,'♠5');assert.equal(s.scores[0],4);assert.equal(s.turn,1);
});
test('予約はパス・別特殊で失効、1枚で終了可能、あがりと最終手番は2枚にしない',()=>{
  const s=state([['♠6','♠5'],['♥6','♥5'],['♦6','♦5'],['♣6','♣5']]);s.remainingPlays=2;passPointSevens(s);assert.equal(s.remainingPlays,1);
  s.turn=0;s.remainingPlays=2;const flip=special(s,0,'flip');usePointSpecial(s,flip);assert.equal(s.remainingPlays,1);
  s.turn=0;s.remainingPlays=2;playPointSevens(s,'♠6');assert.ok(endPointSevensTurn(s));assert.equal(s.turn,1);
  const final=state([['♠6'],['♥6','♥5'],[],[]]);final.finishOrder=[2,3];final.doubleReady[1]=true;playPointSevens(final,'♠6');assert.equal(final.phase,'final');assert.equal(final.remainingPlays,1);playPointSevens(final,'♥6');assert.equal(final.penalties[1],1);assert.equal(final.phase,'done');
});
test('パス免除は0点・1周判定には算入、強制配置中の全特殊は禁止',()=>{
  const s=state([['♠3'],['♥6'],['♦6'],['♣6']]);const free=special(s,0,'freePass');usePointSpecial(s,free);assert.equal(s.scores[0],0);assert.equal(s.passes[0],1);assert.equal(s.freePasses[0],1);
  passPointSevens(s);passPointSevens(s);passPointSevens(s);assert.ok(s.forced);
  for(const kind of pointSpecialKinds){const id=special(s,0,kind),before=structuredClone(s);assert.equal(usePointSpecial(s,id,{cardId:'♠3',target:1}),false);assert.deepEqual(s,before);}
});
test('譲渡: 相手の任意手札で割込み、通常順を消費せず復帰、予約は保持',()=>{
  const s=state([['♠3','♠6'],['♥6','♥5'],['♦6'],['♣6']]);s.doubleReady[1]=true;const id=special(s,0,'gift');
  usePointSpecial(s,id,{cardId:'♠3',target:1});assert.equal(s.phase,'interrupt');assert.equal(s.turn,1);assert.equal(s.scores[0],0);assert.equal(s.hands[1].length,3);
  const other=special(s,1,'flip');assert.equal(usePointSpecial(s,other),false);assert.equal(passPointSevens(s),false);
  playPointSevens(s,'♥6');assert.equal(s.scores[1],2);assert.equal(s.phase,'play');assert.equal(s.turn,1);assert.equal(s.remainingPlays,2);assert.equal(s.hands[1].length,2);
});
test('譲渡: 通常順は渡す側の次から、割込み拒否・合法手なしは無減点',()=>{
  const s=state([['♠3','♠6'],['♥6'],['♦6','♦5'],['♣6']]);const id=special(s,0,'gift');usePointSpecial(s,id,{cardId:'♠3',target:2});assert.equal(s.turn,2);assert.ok(skipPointInterrupt(s));assert.equal(s.turn,1);assert.equal(s.scores[2],0);assert.equal(s.passes[2],0);
  const blocked=state([['♠3','♠6'],['♥6'],['♦3'],['♣6']]);const no=special(blocked,0,'gift');usePointSpecial(blocked,no,{cardId:'♠3',target:2});assert.equal(blocked.phase,'play');assert.equal(blocked.turn,1);assert.equal(blocked.scores[2],0);
});
test('譲渡で即あがり・最後の1人の割込みが最終1手、累計加算は1回',()=>{
  const s=state([['♠3'],['♥6'],[],[]]);s.finishOrder=[2,3];s.totals=[10,20,30,40];const id=special(s,0,'gift');special(s,0,'flip');
  usePointSpecial(s,id,{cardId:'♠3',target:1});assert.deepEqual(s.finishOrder,[2,3,0]);assert.equal(s.specials[0].length,0);assert.equal(s.interrupt!.final,true);assert.equal(skipPointInterrupt(s),false);
  playPointSevens(s,'♥6');assert.equal(s.phase,'done');assert.equal(s.scores[1],1);assert.equal(s.penalties[1],1);assert.deepEqual(s.totals,[10,21,30,40]);
  const before=structuredClone(s);assert.equal(playPointSevens(s,'♠3'),false);assert.equal(usePointSpecial(s,id),false);assert.deepEqual(s,before);
});
test('不正指定・相手・カード・途中操作は特殊を消費せず無変更',()=>{
  const s=state([['♠3','♠6'],['♥6'],['♦6'],['♣6']]);const force=special(s,0,'force'),gift=special(s,0,'gift');
  for(const args of [{cardId:'♠7'},{cardId:'unknown'}]){const before=structuredClone(s);assert.equal(usePointSpecial(s,force,args),false);assert.deepEqual(s,before);}
  for(const args of [{cardId:'♠3',target:0},{cardId:'♠3',target:9},{cardId:'♠3',target:1.1},{cardId:'♥6',target:1}]){const before=structuredClone(s);assert.equal(usePointSpecial(s,gift,args),false);assert.deepEqual(s,before);}
});
test('300配札×5ラウンド: 全特殊と割込み、得点保存、52枚保存、順位と累計',()=>{
  const used=new Set<string>();
  for(let seed=1;seed<=300;seed++){
    const rng=seeded(seed);let s=createPointSevens(rng),totals=[0,0,0,0];
    for(let round=1;round<=5;round++){
      let steps=0;
      while(s.phase!=='done'&&steps++<1000){
        if(s.phase==='choice'){assert.equal(s.specials[s.bonusOwner!].length,1);assert.ok(choosePointSpecial(s,pointBonusChoice(s)));continue;}
        const p=s.turn,specialMove=pointSpecialMove(s);
        if(specialMove){used.add(s.specials[p].find(c=>c.id===specialMove.id)!.kind);assert.ok(usePointSpecial(s,specialMove.id,specialMove.args));}
        else{const id=pointSevensMove(s.hands[p],s.board,{forced:s.forced||s.phase!=='play'||s.placedThisTurn>0,lastPassBoardSize:s.lastPassBoardSize[p],inverted:s.inverted});if(id)assert.ok(playPointSevens(s,id));else if(s.phase==='interrupt')assert.ok(skipPointInterrupt(s));else if(s.placedThisTurn>0)assert.ok(endPointSevensTurn(s));else assert.ok(passPointSevens(s));}
        const all=[...s.board,...s.hands.flat()];assert.equal(all.length,52);assert.equal(new Set(all.map(c=>c.id)).size,52);
        for(let q=0;q<4;q++)assert.equal(s.scores[q],Object.values(s.placements).filter(v=>v.player===q).reduce((sum,v)=>sum+v.points,0)-s.passes[q]+s.freePasses[q]-s.penalties[q]);
      }
      assert.equal(s.phase,'done');assert.equal(new Set(s.finishOrder).size,4);assert.ok(s.specials.every(h=>h.length===0));totals=totals.map((v,p)=>v+s.scores[p]);assert.deepEqual(s.totals,totals);
      if(round<5){const previousLast=pointSevensRanking(s)[3];s=nextPointSevensRound(s,rng);assert.equal(s.bonusOwner,previousLast);assert.equal(s.inverted,false);assert.equal(s.round,round+1);}
    }
  }
  assert.deepEqual([...used].sort(),[...pointSpecialKinds].sort());
});
