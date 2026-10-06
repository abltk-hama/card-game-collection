import { shuffle, type Random } from './common.ts';
export const colors = ['red', 'yellow', 'green', 'blue'] as const;
export type Color = typeof colors[number];
export type Kind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'draw4' | 'swap' | 'shield' | 'all' | 'target';
export interface UnoCard { id: number; color: Color | null; kind: Kind; value?: number; expand?: { color?: Color; value?: number }; }
export interface UnoState {
  hands: UnoCard[][]; drawPile: UnoCard[]; discard: UnoCard[]; color: Color;
  turn: number; direction: number; shields: boolean[]; winner: number | null;
  expandEnabled: boolean; expanded: boolean; topValue: number | null; shieldPlus: boolean[];
  attack: { count: number; source: number } | null; finishCandidates: number[];
  tie: boolean; stalls: number; drawnId: number | null; message: string;
}
export function unoDeck(custom: boolean, expandEnabled = false, random: Random = Math.random, expandRate = 25): UnoCard[] {
  if (!Number.isFinite(expandRate) || expandRate < 0 || expandRate > 100 || expandRate % 5 !== 0) throw new RangeError('Invalid Expand rate');
  const cards: UnoCard[] = [];
  const add = (color: Color | null, kind: Kind, value?: number) => cards.push({ id: cards.length, color, kind, value });
  for (const color of colors) {
    add(color, 'number', 0);
    for (let copy = 0; copy < 2; copy++) {
      for (let n = 1; n <= 9; n++) add(color, 'number', n);
      for (const kind of ['skip', 'reverse', 'draw2'] as const) add(color, kind);
    }
  }
  for (let i = 0; i < 4; i++) { add(null, 'wild'); add(null, 'draw4'); }
  if (custom) for (let i = 0; i < 2; i++) for (const kind of ['swap', 'shield', 'all', 'target'] as const) add(null, kind);
  if (expandEnabled) for (const card of cards) {
    if (card.kind === 'swap' || random() >= expandRate / 100) continue;
    if (card.kind === 'number') {
      const otherColors = colors.filter(c=>c!==card.color);
      const values = Array.from({length:10},(_,i)=>i).filter(v=>v!==card.value);
      card.expand = { color: otherColors[Math.floor(random()*3)], value: values[Math.floor(random()*9)] };
    } else card.expand = {};
  }
  return cards;
}
export function createUno(custom: boolean, random: Random = Math.random, expandEnabled = false, expandRate = 25): UnoState {
  const pile = shuffle(unoDeck(custom, expandEnabled, random, expandRate), random);
  const hands = Array.from({ length: 4 }, () => pile.splice(0, 7));
  const start = pile.findIndex(c => c.kind === 'number');
  const first = pile.splice(start, 1)[0];
  return { hands, drawPile: pile, discard: [first], color: first.color!, turn: 0, direction: 1, shields: [false, false, false, false], winner: null, tie: false, stalls: 0, drawnId: null, expandEnabled, expanded: false, topValue: first.value!, shieldPlus: [false,false,false,false], attack: null, finishCandidates: [], message: '色か数字・記号が同じカードを出そう。' };
}
export type UnoFace = 'base' | 'expand';
export function canPlay(card: UnoCard, hand: readonly UnoCard[], top: UnoCard, color: Color, expanded = false, topValue = top.value, face: UnoFace = 'base'): boolean {
  if (face !== 'base' && face !== 'expand') return false;
  if (face === 'expand' && (!expanded || card.kind !== 'number' || !card.expand)) return false;
  if (card.kind === 'draw4') return !hand.some(c => c.color === color || expanded && c.kind === 'number' && c.expand?.color === color);
  if (card.color === null) return true;
  const cardColor = face === 'expand' ? card.expand!.color : card.color;
  const value = face === 'expand' ? card.expand!.value : card.value;
  return cardColor === color || (card.kind === 'number' && top.kind === 'number' ? value === topValue : card.kind === top.kind);
}
export function canReturnUno(s: UnoState, card: UnoCard): boolean {
  return !!s.attack && s.expandEnabled && s.expanded && card.kind === 'draw4' && !!card.expand;
}
export function canPlayUno(s: UnoState, card: UnoCard, face?: UnoFace): boolean {
  if (s.winner !== null || s.tie || !s.hands[s.turn].some(c=>c.id===card.id) || s.drawnId !== null && card.id !== s.drawnId) return false;
  if (s.attack) return (!face || face === 'base') && canReturnUno(s,card);
  const top = s.discard.at(-1)!;
  const legal = (f: UnoFace) => canPlay(card,s.hands[s.turn],top,s.color,s.expanded,s.topValue ?? undefined,f);
  return face ? legal(face) : legal('base') || legal('expand');
}
function advance(s: UnoState, steps = 1): void { s.turn = (s.turn + s.direction * steps + 8) % 4; s.drawnId = null; }
export function drawCards(s: UnoState, player: number, count: number, random: Random = Math.random): UnoCard[] {
  const result: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    if (!s.drawPile.length && s.discard.length > 1) {
      const top = s.discard.pop()!; s.drawPile = shuffle(s.discard, random); s.discard = [top];
    }
    const card = s.drawPile.pop(); if (!card) break;
    s.hands[player].push(card); result.push(card);
  }
  return result;
}
// 反射ドローは再反射せず、防御のみ可能。手番は変更しない。
function applyAttack(s: UnoState, player: number, count: number, source: number, random: Random): string {
  if (!s.shields[player]) {
    const drawn = drawCards(s,player,count,random).length;
    return `${count}枚の攻撃を受けて${drawn}枚引きました。`;
  }
  const reflects = player !== source && s.expanded && s.shieldPlus[player];
  s.shields[player] = false; s.shieldPlus[player] = false;
  if (!reflects) return 'シールドで防ぎました。';
  if (s.shields[source]) { s.shields[source] = false; s.shieldPlus[source] = false; return `${count}枚を反射し、攻撃者もシールドで防ぎました。`; }
  const drawn = drawCards(s,source,count,random).length;
  return `${count}枚を反射し、攻撃者が${drawn}枚引きました。`;
}
function finishUno(s: UnoState, player: number, target?: number): void {
  if (!s.hands[player].length && !s.finishCandidates.includes(player)) s.finishCandidates.push(player);
  if (target !== undefined && !s.hands[target].length && !s.finishCandidates.includes(target)) s.finishCandidates.push(target);
  if (!s.attack) {
    s.winner = s.finishCandidates.find(p=>!s.hands[p].length) ?? null;
    s.finishCandidates = [];
  }
}
export function acceptUnoAttack(s: UnoState, random: Random = Math.random): boolean {
  if (!s.attack || s.winner !== null || s.tie) return false;
  const {count,source} = s.attack;
  s.message = applyAttack(s,s.turn,count,source,random);
  s.attack = null; finishUno(s,source);
  if (s.winner === null) advance(s);
  return true;
}
export function playUno(s: UnoState, index: number, chosenColor?: Color, target?: number, random: Random = Math.random, face: UnoFace = 'base'): boolean {
  const player = s.turn, hand = s.hands[player], card = hand[index];
  if (!card || !canPlayUno(s,card,face)) return false;
  if (card.color === null && (!chosenColor || !colors.includes(chosenColor))) return false;
  if ((card.kind === 'swap' || card.kind === 'target') && (target === undefined || !Number.isInteger(target) || target < 0 || target > 3 || card.kind === 'swap' && target === player)) return false;
  hand.splice(index,1); s.discard.push(card);
  s.color = (face === 'expand' ? card.expand!.color : card.color) ?? chosenColor!;
  s.topValue = card.kind === 'number' ? (face === 'expand' ? card.expand!.value! : card.value!) : null;
  s.stalls = 0; s.drawnId = null;
  const enhanced = s.expandEnabled && s.expanded && !!card.expand;
  s.message = `${unoLabel(card)}${face === 'expand' ? 'の追加面' : ''}を出しました。`;
  if (s.attack) {
    s.attack = {count:s.attack.count+4,source:player};
    s.message += ` ${s.attack.count}枚の攻撃を次の人へ返しました。`;
    finishUno(s,player); advance(s); return true;
  }
  if (card.kind === 'wild' && s.expandEnabled && card.expand) {
    s.expanded = !s.expanded; s.message += ` エクスパンド${s.expanded?'On':'Off'}。`;
  }
  let steps = 1;
  if (card.kind === 'reverse') { s.direction *= -1; if (enhanced) steps = 2; }
  if (card.kind === 'skip') steps = enhanced ? 4 : 2;
  if (card.kind === 'draw2' || card.kind === 'draw4') {
    const count = card.kind === 'draw2' ? enhanced ? 3 : 2 : 4;
    if (s.expandEnabled) {
      s.attack = {count,source:player}; s.message += ` 次の人は${count}枚を受けるか、On中の＋ドロー4で返せます。`;
    } else { s.message += ' '+applyAttack(s,(player+s.direction+4)%4,count,player,random); steps = 2; }
  }
  if (card.kind === 'shield') { s.shields[player] = true; s.shieldPlus[player] = !!card.expand; }
  if (card.kind === 'all') for (let p=0;p<4;p++) if (p!==player) s.message += ' '+applyAttack(s,p,enhanced?2:1,player,random);
  if (card.kind === 'swap') [s.hands[player],s.hands[target!]] = [s.hands[target!],s.hands[player]];
  if (card.kind === 'target' && enhanced) s.message += ' '+applyAttack(s,target!,1,player,random);
  finishUno(s,player,card.kind==='swap'?target:undefined);
  if (s.winner === null) { if (card.kind === 'target') { s.turn = target!; s.drawnId = null; } else advance(s,steps); }
  return true;
}
export function drawTurn(s: UnoState, random: Random = Math.random): boolean {
  if (s.attack || s.winner !== null || s.tie || s.drawnId !== null) return false;
  const cards = drawCards(s, s.turn, 1, random);
  if (!cards.length) {
    if (s.hands[s.turn].some(c => canPlayUno(s,c))) {
      s.message = '山札が空です。出せる手札を選んでください。'; s.stalls = 0; return false;
    }
    s.stalls++; s.message = '山札がなく、手番を終了しました。';
    if (s.stalls >= 4) s.tie = true; else advance(s);
    return true;
  }
  s.stalls = 0;
  const card = cards[0];
  if (canPlayUno(s,card)) {
    s.drawnId = card.id; s.message = '引いたカードを出すか、手番を終了できます。';
  } else { s.message = '1枚引いて手番を終了しました。'; advance(s); }
  return true;
}
export function passUno(s: UnoState): boolean {
  if (s.attack || s.drawnId === null || s.winner !== null || s.tie) return false;
  s.message = '引いたカードを手札に残しました。'; advance(s); return true;
}
export function unoLabel(card: UnoCard): string {
  return card.kind === 'number' ? String(card.value) : ({ skip: 'SKIP', reverse: '↔', draw2: '+2', wild: 'COLOR', draw4: '+4', swap: '交換', shield: '防御', all: '全員+1', target: 'ターゲット' })[card.kind];
}
// AIの判断材料は自身の手札・場・公開されている枚数のみ。
export function unoMove(hand: readonly UnoCard[], top: UnoCard, color: Color, counts: readonly number[], player: number, drawnId: number | null, state?: UnoState) {
  const playable = hand.flatMap((c, i) => (drawnId === null || c.id === drawnId) && (state ? canPlayUno(state,c) : canPlay(c, hand, top, color)) ? [i] : []);
  const index = playable.sort((a, b) => Number(hand[a].color === null) - Number(hand[b].color === null))[0];
  const chosenColor = [...colors].sort((a, b) => hand.filter(c => c.color === b).length - hand.filter(c => c.color === a).length)[0];
  const target = counts.map((count, i) => ({ count, i })).filter(p => p.i !== player).sort((a, b) => a.count - b.count)[0].i;
  const face: UnoFace = index !== undefined && state && !canPlayUno(state,hand[index],'base') ? 'expand' : 'base';
  return { index, color: chosenColor, target: index !== undefined && hand[index].kind === 'target' ? player : target, face };
}

