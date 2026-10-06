import test from 'node:test';
import assert from 'node:assert/strict';
import { createUno, unoDeck, canPlayUno, playUno, acceptUnoAttack, drawTurn, passUno, unoMove, type UnoCard, type UnoState } from '../src/uno.ts';
function seeded(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const card=(id:number,kind:UnoCard['kind'],color:UnoCard['color']=null,value?:number,plus=false):UnoCard=>({id,kind,color,value,...(plus?{expand:kind==='number'?{color:color==='blue'?'red':'blue',value:(value!+1)%10}:{}}:{})});
function state():UnoState{return {...createUno(true,seeded(1),true),hands:[[card(1,'number','red',2)],[card(2,'number','blue',3)],[card(3,'number','green',4)],[card(4,'number','yellow',5)]],drawPile:Array.from({length:40},(_,i)=>card(20+i,'number','green',i%10)),discard:[card(0,'number','red',1)],color:'red',topValue:1,turn:0,expanded:true,shields:[false,false,false,false],shieldPlus:[false,false,false,false]};}
test('付与: 独立25%境界、追加色・数字は両方別、交換のみ対象外',()=>{
 const all=unoDeck(true,true,()=>0),none=unoDeck(true,true,()=>.25);assert.equal(all.length,116);assert.ok(all.filter(c=>!['swap'].includes(c.kind)).every(c=>c.expand));assert.ok(none.every(c=>!c.expand));
 for(const c of all.filter(c=>c.kind==='number')){assert.notEqual(c.color,c.expand!.color);assert.notEqual(c.value,c.expand!.value);}
 assert.ok(all.filter(c=>['swap'].includes(c.kind)).every(c=>!c.expand));assert.ok(unoDeck(true).every(c=>!c.expand));
});
test('数字: Onで面選択、選んだ色と数字が次の判定、Offの追加面は無変更拒否',()=>{
 const s=state();s.hands[0]=[card(1,'number','green',0,true),card(5,'number','yellow',4)];assert.equal(canPlayUno(s,s.hands[0][0],'base'),false);assert.ok(canPlayUno(s,s.hands[0][0],'expand'));
 assert.ok(playUno(s,0,undefined,undefined,seeded(1),'expand'));assert.equal(s.color,'blue');assert.equal(s.topValue,1);s.hands[1]=[card(2,'number','yellow',1)];assert.ok(canPlayUno(s,s.hands[1][0]));
 const off=state();off.expanded=false;off.hands[0]=[card(1,'number','green',0,true)];const before=structuredClone(off);assert.equal(playUno(off,0,undefined,undefined,seeded(1),'expand'),false);assert.deepEqual(off,before);
});
test('ワイルド: 初期Off、＋だけ切替、色指定必須、2枚でOff復帰',()=>{
 const s=state();s.expanded=false;s.hands[0]=[card(1,'wild',null,undefined,true),card(5,'number','red',2)];s.hands[1]=[card(2,'wild',null,undefined,true),card(6,'number','blue',1)];assert.equal(playUno(s,0),false);assert.ok(playUno(s,0,'green'));assert.equal(s.expanded,true);assert.ok(playUno(s,0,'blue'));assert.equal(s.expanded,false);
 s.hands[2]=[card(3,'wild'),card(7,'number','green',2)];playUno(s,0,'red');assert.equal(s.expanded,false);
});
test('ドロー3→＋4→＋4: 7・11枚、色保持制限を返し時だけ免除、2同士は不可',()=>{
 const s=state();s.hands[0]=[card(1,'draw2','red',undefined,true),card(5,'number','red',2)];s.hands[1]=[card(2,'draw4',null,undefined,true),card(6,'number','red',2),card(7,'draw2','red')];s.hands[2]=[card(3,'draw4',null,undefined,true),card(8,'number','blue',2)];
 playUno(s,0);assert.equal(s.attack!.count,3);assert.equal(s.turn,1);assert.equal(drawTurn(s),false);assert.equal(passUno(s),false);assert.equal(canPlayUno(s,s.hands[1][2]),false);assert.ok(playUno(s,0,'blue'));assert.equal(s.attack!.count,7);playUno(s,0,'green');assert.equal(s.attack!.count,11);const count=s.hands[3].length;acceptUnoAttack(s);assert.equal(s.hands[3].length,count+11);assert.equal(s.attack,null);assert.equal(s.turn,0);
 const normal=state();normal.hands[0]=[card(1,'draw4',null,undefined,true),card(5,'number','blue',2,true)];assert.equal(canPlayUno(normal,normal.hands[0][0]),false); // 追加面が赤
});
test('Offと＋なし: ドロー2のまま、返し不可、Onでも普通のドロー4は返せない',()=>{
 for(const expanded of [false,true]){const s=state();s.expanded=expanded;s.hands[0]=[card(1,'draw2','red'),card(5,'number','red',2)];s.hands[1]=[card(2,'draw4',null,undefined,expanded?false:true)];playUno(s,0);assert.equal(s.attack!.count,2);const before=structuredClone(s);assert.equal(playUno(s,0,'blue'),false);assert.deepEqual(s,before);assert.ok(acceptUnoAttack(s));}
});
test('スキップ・リバース: ＋Onで自分再手番／反転後次を飛ばす、Off従来',()=>{
 for(const expanded of [true,false])for(const kind of ['skip','reverse'] as const){const s=state();s.expanded=expanded;s.hands[0]=[card(1,kind,'red',undefined,true),card(5,'number','red',2)];playUno(s,0);assert.equal(s.turn,kind==='skip'?expanded?0:2:expanded?2:3);assert.equal(s.direction,kind==='reverse'?-1:1);}
});
test('＋シールド: 発動時Onなら最後の攻撃者へ反射、ドロー4で返せず手番も変えない',()=>{
 const s=state();s.shields[2]=true;s.shieldPlus[2]=true;s.hands[0]=[card(1,'draw2','red',undefined,true),card(5,'number','red',2)];s.hands[1]=[card(2,'draw4',null,undefined,true),card(6,'draw4',null,undefined,true)];playUno(s,0);playUno(s,0,'blue');const source=s.hands[1].length,target=s.hands[2].length;acceptUnoAttack(s);assert.equal(s.hands[1].length,source+7);assert.equal(s.hands[2].length,target);assert.equal(s.turn,3);assert.equal(s.attack,null);assert.equal(s.shields[2],false);
});
test('反射先のシールド: 防御だけ消費し再反射なし、Offでは通常防御',()=>{
 for(const expanded of [true,false]){const s=state();s.expanded=expanded;s.shields[0]=true;s.shieldPlus[0]=true;s.shields[1]=true;s.shieldPlus[1]=true;s.hands[0]=[card(1,'draw2','red'),card(5,'number','red',2)];playUno(s,0);acceptUnoAttack(s);assert.equal(s.hands[0].length,1);assert.equal(s.hands[1].length,1);assert.equal(s.shields[1],false);assert.equal(s.shields[0],!expanded);assert.equal(s.turn,2);}
});
test('シールド性質保持: Offで＋を設置、Onへ切替後の攻撃で反射',()=>{
 const s=state();s.expanded=false;s.hands[0]=[card(1,'shield',null,undefined,true),card(5,'number','red',2)];playUno(s,0,'red');assert.ok(s.shieldPlus[0]);s.hands[1]=[card(2,'wild',null,undefined,true),card(6,'number','red',2)];playUno(s,0,'red');s.turn=3;s.hands[3]=[card(4,'draw2','red'),card(7,'number','red',2)];playUno(s,0);acceptUnoAttack(s);assert.equal(s.hands[3].length,3);assert.equal(s.hands[0].length,1);assert.equal(s.turn,1);
});
test('全員＋1: 反射は攻撃者へ、再反射なし、最後の1枚でも攻撃者が補充なら勝てない',()=>{
 const s=state();s.hands[0]=[card(1,'all')];s.shields[1]=true;s.shieldPlus[1]=true;playUno(s,0,'red');assert.equal(s.hands[0].length,1);assert.equal(s.winner,null);assert.equal(s.turn,1);
});
test('最後のドロー: 解決まで勝者保留、反射補充で勝利取消、先に空になった人を優先',()=>{
 const s=state();s.hands[0]=[card(1,'draw2','red')];playUno(s,0);assert.equal(s.winner,null);acceptUnoAttack(s);assert.equal(s.winner,0);
 const reflected=state();reflected.hands[0]=[card(1,'draw2','red')];reflected.shields[1]=true;reflected.shieldPlus[1]=true;playUno(reflected,0);acceptUnoAttack(reflected);assert.equal(reflected.winner,null);assert.equal(reflected.hands[0].length,2);
 const chain=state();chain.hands[0]=[card(1,'draw2','red')];chain.hands[1]=[card(2,'draw4',null,undefined,true)];playUno(chain,0);playUno(chain,0,'blue');assert.equal(chain.winner,null);acceptUnoAttack(chain);assert.equal(chain.winner,0);
 const redirected=state();redirected.hands[0]=[card(1,'draw2','red')];redirected.hands[1]=[card(2,'draw4',null,undefined,true)];redirected.shields[2]=true;redirected.shieldPlus[2]=true;playUno(redirected,0);playUno(redirected,0,'blue');acceptUnoAttack(redirected);assert.equal(redirected.winner,0);assert.equal(redirected.hands[1].length,6);
});
test('不正操作・終了後は無変更、攻撃中は別カード・1枚ドロー・パス不可',()=>{
 const s=state();s.hands[0]=[card(1,'draw2','red'),card(5,'number','red',2)];playUno(s,0);for(const act of [()=>playUno(s,0),()=>drawTurn(s),()=>passUno(s)]){const before=structuredClone(s);assert.equal(act(),false);assert.deepEqual(s,before);}acceptUnoAttack(s);s.winner=0;const before=structuredClone(s);assert.equal(acceptUnoAttack(s),false);assert.equal(playUno(s,0),false);assert.deepEqual(s,before);
});
test('攻撃の山札不足: 場トップ維持、引ける分を補充し解決',()=>{
 const s=state();s.hands[0]=[card(1,'draw2','red',undefined,true),card(5,'number','red',2)];s.drawPile=[];playUno(s,0);acceptUnoAttack(s,seeded(1));assert.equal(s.hands[1].length,2);assert.equal(s.discard.length,1);assert.equal(s.discard[0].id,1);assert.equal(s.attack,null);
});
test('1,000対戦: エクスパンドと独自カード設定、合法面・攻撃・反射・108/116枚保存・終了',()=>{
 let returns=0,alternates=0,toggles=0;
 for(let seed=1;seed<=1000;seed++){const random=seeded(seed),custom=seed%2===0,s=createUno(custom,random,true,[0,25,100][seed%3]);const total=custom?116:108;const initial=new Map([...s.hands.flat(),...s.drawPile,...s.discard].map(c=>[c.id,JSON.stringify(c.expand)]));let steps=0;
 while(s.winner===null&&!s.tie&&steps++<20000){const p=s.turn,move=unoMove(s.hands[p],s.discard.at(-1)!,s.color,s.hands.map(h=>h.length),p,s.drawnId,s),old=s.expanded;
 if(move.index!==undefined){if(s.attack)returns++;if(move.face==='expand')alternates++;assert.ok(canPlayUno(s,s.hands[p][move.index],move.face));assert.ok(playUno(s,move.index,move.color,move.target,random,move.face));}
 else assert.ok(s.attack?acceptUnoAttack(s,random):s.drawnId===null?drawTurn(s,random):passUno(s));
 if(old!==s.expanded)toggles++;const all=[...s.hands.flat(),...s.drawPile,...s.discard];assert.equal(all.length,total);assert.equal(new Set(all.map(c=>c.id)).size,total);for(const c of all)assert.equal(JSON.stringify(c.expand),initial.get(c.id));if(s.attack)assert.equal(s.winner,null);
 }
 assert.ok(s.winner!==null||s.tie,`seed ${seed} did not finish`);if(s.winner!==null)assert.equal(s.hands[s.winner].length,0);
 }assert.ok(returns>0);assert.ok(alternates>0);assert.ok(toggles>0);
});

test('付与率設定: 0/100%・5%刻み・独自カード2枚追加、＋全員とターゲット対象',()=>{
 assert.ok(unoDeck(true,true,seeded(1),0).every(c=>!c.expand));const full=unoDeck(true,true,seeded(1),100);assert.equal(full.length,116);assert.equal(full.filter(c=>c.kind==='target').length,2);assert.ok(full.filter(c=>c.kind!=='swap').every(c=>c.expand));assert.ok(full.filter(c=>c.kind==='swap').every(c=>!c.expand));
 for(const rate of [-5,101,23,NaN])assert.throws(()=>unoDeck(true,true,seeded(1),rate),RangeError);
});
test('全員ドロー2: Onのみ2枚、複数シールド反射は使用者へ2枚ずつ、勝者再判定',()=>{
 for(const expanded of [true,false]){const s=state();s.expanded=expanded;s.hands[0]=[card(1,'all',null,undefined,true),card(5,'number','red',2)];playUno(s,0,'red');assert.deepEqual(s.hands.map(h=>h.length),[1,expanded?3:2,expanded?3:2,expanded?3:2]);}
 const s=state();s.hands[0]=[card(1,'all',null,undefined,true)];s.shields[1]=s.shields[2]=true;s.shieldPlus[1]=s.shieldPlus[2]=true;playUno(s,0,'red');assert.equal(s.hands[0].length,4);assert.equal(s.winner,null);assert.equal(s.turn,1);
});
test('ターゲット: 指定へ手番、その後は現在方向、自分指定と不正引数',()=>{
 for(const direction of [1,-1]){const s=state();s.direction=direction;s.hands[2].push(card(8,'number','yellow',8));s.hands[0]=[card(1,'target'),card(5,'number','blue',1)];playUno(s,0,'green',2);assert.equal(s.turn,2);playUno(s,0);assert.equal(s.turn,direction===1?3:1);assert.equal(s.winner,null);}
 const self=state();self.hands[0]=[card(1,'target'),card(5,'number','blue',1)];playUno(self,0,'blue',0);assert.equal(self.turn,0);
 for(const target of [undefined,-1,4,1.5]){const s=state();s.hands[0]=[card(1,'target')];const before=structuredClone(s);assert.equal(playUno(s,0,'red',target),false);assert.deepEqual(s,before);}
});
test('＋ターゲット: 引いてから任意手札、盾反射・自分防御、最後の1枚の補充',()=>{
 const s=state();s.hands[0]=[card(1,'target',null,undefined,true),card(5,'number','red',2)];playUno(s,0,'green',2);assert.equal(s.turn,2);assert.equal(s.hands[2].length,2);assert.equal(s.drawnId,null);assert.ok(canPlayUno(s,s.hands[2][0]));
 const r=state();r.hands[0]=[card(1,'target',null,undefined,true)];r.shields[2]=true;r.shieldPlus[2]=true;playUno(r,0,'red',2);assert.equal(r.winner,null);assert.equal(r.hands[0].length,1);assert.equal(r.turn,2);
 const self=state();self.hands[0]=[card(1,'target',null,undefined,true)];self.shields[0]=true;self.shieldPlus[0]=true;playUno(self,0,'red',0);assert.equal(self.winner,0);assert.equal(self.shields[0],false);
 const noShield=state();noShield.hands[0]=[card(1,'target',null,undefined,true)];playUno(noShield,0,'red',0);assert.equal(noShield.winner,null);assert.equal(noShield.turn,0);assert.equal(noShield.hands[0].length,1);
});
