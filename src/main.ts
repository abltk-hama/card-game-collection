import './style.css';
import { unoIcon } from './uno-icons.ts';
import { unoRules } from './uno-rules.ts';
import { names, cardLabel, type PlayingCard } from './common.ts';
import { createMemory, reveal, resolvePair, memoryMove, type MemoryState } from './memory.ts';
import { createOldMaid, nextPlayer, takeCard, type OldMaidState } from './oldmaid.ts';
import { createUno, canPlayUno, acceptUnoAttack, playUno, drawTurn, passUno, unoLabel, unoMove, colors, type Color, type UnoCard, type UnoFace, type UnoState } from './uno.ts';
import { createDaifugo, nextRound, playDaifugo, passDaifugo, canPlayDaifugo, exchangeCards, daifugoMove, classNames, type DaifugoState } from './daifugo.ts';
import { createGin, nextGinRound, declineGin, drawGin, discardGin, chooseGinDiscard, shouldTakeGinDiscard, type GinState } from './gin.ts';
import { ginView, ginRules } from './gin-view.ts';

import { createSevens, playSevens, passSevens, sevensMove, type SevensState } from './sevens.ts';
import { sevensView, sevensRules } from './sevens-view.ts';

import { pointFixedPoints, createPointSevens, playPointSevens, passPointSevens, pointSevensMove, nextPointSevensRound, pointSpecialMove, pointBonusChoice, choosePointSpecial, usePointSpecial, endPointSevensTurn, skipPointInterrupt, type PointSpecialKind, type PointSevensState } from './point-sevens.ts';
import { pointSevensView, pointSevensRules, type PointSelection } from './point-sevens-view.ts';

type Game = 'memory' | 'oldmaid' | 'uno' | 'daifugo' | 'gin' | 'sevens' | 'pointSevens';
const root = document.querySelector<HTMLDivElement>('#app')!;
let game: Game | null = null;
let memory: MemoryState;
let oldmaid: OldMaidState;
let uno: UnoState;
let daifugo: DaifugoState;
let gin: GinState;
let sevens: SevensState;
let pointSevens: PointSevensState;
let pointSelection: PointSelection = { specialId: null, cardId: null, target: null };
let ginSelected: string | null = null;
let selectedCards: string[] = [];
let custom = true;
let expandEnabled = true;
let expandRate = 25;
let selectedFace: UnoFace | null = null;
let pending: number | null = null;
let selectedColor: Color | null = null;
let selectedTarget: number | null = null;
let busy = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
const colorNames: Record<Color, string> = { red: '赤', yellow: '黄', green: '緑', blue: '青' };
const titles: Record<Game, string> = { memory: '神経衰弱', oldmaid: 'ババ抜き', uno: 'カラーマッチ', daifugo: '大富豪', gin: 'ジンラミー', sevens: '七並べ', pointSevens: 'ポイント七並べ' };
function later(action: () => void, delay = 800): void {
  const token = generation;
  clearTimeout(timer); timer = setTimeout(() => { if (token === generation) action(); }, delay);
}
function reset(): void { generation++; clearTimeout(timer); busy = false; selectedFace = null; pending = null; selectedColor = null; selectedTarget = null; selectedCards = []; ginSelected = null; pointSelection = { specialId: null, cardId: null, target: null }; }
function start(g: Game): void {
  reset(); game = g;
  if (g === 'memory') memory = createMemory();
  if (g === 'oldmaid') oldmaid = createOldMaid();
  if (g === 'uno') uno = createUno(custom,Math.random,expandEnabled,expandRate);
  if (g === 'daifugo') daifugo = createDaifugo();
  if (g === 'gin') gin = createGin();
  if (g === 'sevens') sevens = createSevens();
  if (g === 'pointSevens') pointSevens = createPointSevens();
  render(); schedule();
}
function button(action: string, label: string, extra = '', disabled = false): string {
  return `<button data-action="${action}" ${extra} ${disabled ? 'disabled' : ''}>${label}</button>`;
}
function playingCard(c: PlayingCard): string {
  return `<span class="playing-card ${c.suit === '♥' || c.suit === '♦' ? 'ink-red' : ''}">${cardLabel(c)}</span>`;
}
function unoCard(c: UnoCard, index?: number, disabled = false): string {
  const expansion = c.expand ? ` ＋エクスパンド${c.kind === 'number' ? `（${colorNames[c.expand.color!]} ${c.expand.value}）` : ''}` : '';
  const label = `${c.color ? colorNames[c.color] : 'ワイルド'} ${unoLabel(c)}${expansion}`;
  const activeLabel = game === 'uno' && uno.expanded && c.expand ? c.kind === 'draw2' ? '+3' : c.kind === 'skip' ? '再手番' : c.kind === 'all' ? '全員+2' : c.kind === 'shield' ? '反射' : unoLabel(c) : unoLabel(c);
  const inside = `<span class="card-corner">${c.color ? colorNames[c.color] : '✦'}</span>${unoIcon(c.kind,game==='uno'&&uno.expanded&&!!c.expand)}<strong class="${c.kind==='number'?'':'action-label'}">${activeLabel}</strong>${c.expand?'<span class="expand-badge" aria-hidden="true">＋</span>':''}<span class="card-foot">${c.expand ? c.kind === 'number' ? `＋ ${colorNames[c.expand.color!]} ${c.expand.value}` : 'EXPAND＋' : c.kind === 'number' ? 'NUMBER' : 'ACTION'}</span>`;
  return index === undefined ? `<div class="uno-card ${c.color ?? 'wild'}" aria-label="${label}">${inside}</div>` : `<button class="uno-card ${c.color ?? 'wild'}" data-action="play" data-index="${index}" aria-label="${label}" ${disabled ? 'disabled' : ''}>${inside}</button>`;
}
function home(): string {
  return `<div class="home"><div class="eyebrow">A LITTLE BREAK, A LITTLE PLAY</div><h1>ひとやすみ<br>カード部<span>♣</span></h1><p class="intro">ひとりでも、テーブルはにぎやか。<br>好きなカードで、AIとひと勝負。</p><div class="section-label">今日、何で遊ぶ？ <span>07 GAMES</span></div><div class="game-list">
    <button class="game-tile" data-action="start" data-game="memory"><span class="tile-icon">♠</span><span><small>01 / MEMORY</small><strong>神経衰弱</strong><em>めくって、覚えて、ペアを探そう。</em><i>24枚 · AIと1対1</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="oldmaid"><span class="tile-icon coral">★</span><span><small>02 / OLD MAID</small><strong>ババ抜き</strong><em>最後のジョーカー、誰の手に？</em><i>あなた＋AI3人</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="uno"><span class="tile-icon gold">↔</span><span><small>03 / COLOR MATCH</small><strong>カラーマッチ</strong><em>色をつないで、逆転の一枚。</em><i>UNO風 · あなた＋AI3人</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="daifugo"><span class="tile-icon royal">♦</span><span><small>04 / DAIFUGO</small><strong>大富豪</strong><em>革命の一手で、頂点をつかもう。</em><i>革命・8切り・都落ち · AI3人</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="gin"><span class="tile-icon teal">♥</span><span><small>05 / GIN RUMMY</small><strong>ジンラミー</strong><em>組をつくって、ノックの勝負。</em><i>100点先取 · AIと1対1</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="sevens"><span class="tile-icon terracotta">7</span><span><small>06 / SEVENS</small><strong>七並べ</strong><em>つないで、待って、先にあがろう。</em><i>パス3回まで · AI3人</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="pointSevens"><span class="tile-icon points">+2</span><span><small>07 / POINT SEVENS</small><strong>ポイント七並べ</strong><em>止めるか、つなぐか。点数で勝負。</em><i>独自ルール · AI3人</i></span><b>↗</b></button>
  </div><label class="custom-option"><span><strong>カラーマッチの独自カード</strong><small>交換 / シールド / 全員ドロー / ターゲット</small></span><input id="custom" type="checkbox" ${custom ? 'checked' : ''} aria-label="独自カードを使う"></label><label class="custom-option"><span><strong>エクスパンド</strong><small>対象カードへ＋効果</small></span><input id="expand" type="checkbox" ${expandEnabled ? 'checked' : ''} aria-label="エクスパンドを使う"></label><div class="expand-rate"><label for="expand-rate">＋付与率 <output id="expand-rate-value">${expandRate}％</output></label><input id="expand-rate" type="range" min="0" max="100" step="5" value="${expandRate}" ${expandEnabled?'':'disabled'}><small>対戦開始時に適用 · 0％で＋なし、100％で全対象カードに付与</small></div><div class="home-note">✦ 登録なし。AI対戦はブラウザーの中で。</div></div>`;
}
function opponents(counts: number[], turn: number, shields?: boolean[], shieldPlus?: boolean[]): string {
  return `<div class="opponents">${counts.slice(1).map((count, i) => `<div class="opponent ${turn === i + 1 ? 'active' : ''}"><div class="avatar">${['S', 'M', 'R'][i]}</div><strong>${names[i + 1]}</strong><span>${count ? `${count}枚` : 'あがり'}${shields?.[i + 1] ? ` · 🛡${shieldPlus?.[i+1]?'＋':''}` : ''}</span></div>`).join('')}</div>`;
}
function result(text: string): string { return `<div class="result" role="status"><small>GAME FINISHED</small><h2>${text}</h2>${button('restart', 'もう一度遊ぶ', 'class="primary"')}${button('home', 'ゲームを選ぶ', 'class="secondary"')}</div>`; }
function memoryView(): string {
  const s = memory;
  return `<div class="scoreboard"><span class="${s.turn === 0 ? 'current' : ''}">あなた <b>${s.scores[0]}</b></span><small>PAIRS</small><span class="${s.turn === 1 ? 'current' : ''}">AI ソラ <b>${s.scores[1]}</b></span></div><div class="status" role="status">${s.done ? 'すべてのペアが揃いました。' : s.turn === 0 ? 'あなたの番 · 2枚めくってください' : 'AI ソラが考えています…'}</div><div class="memory-grid">${s.cards.map((value, i) => {
    const visible = s.matched[i] || s.open.includes(i);
    return button('flip', visible ? `<span>${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'][value]}</span><small>♠</small>` : '♣', `class="memory-card ${visible ? 'face' : ''} ${s.matched[i] ? 'matched' : ''}" data-index="${i}" aria-label="${visible ? `カード${value}` : `伏せたカード${i + 1}`}"`, s.done || busy || s.turn !== 0 || s.matched[i] || s.open.includes(i));
  }).join('')}</div>${s.done ? result(s.scores[0] === s.scores[1] ? '引き分け！' : s.scores[0] > s.scores[1] ? 'あなたの勝ち！' : 'AI ソラの勝ち！') : ''}`;
}
function oldmaidView(): string {
  const s = oldmaid, target = nextPlayer(s, s.turn);
  return `${opponents(s.hands.map(h => h.length), s.turn)}<div class="status" role="status">${s.done ? '勝負が決まりました。' : `${names[s.turn]}の番 · ${s.message}`}</div><div class="table-area"><small>${s.turn === 0 && !s.done ? `${names[target]}のカードを1枚選んでね` : '次の一枚を待っています'}</small><div class="pick-hand">${!s.done && s.turn === 0 ? s.hands[target].map((_, i) => button('take', '♣', `class="card-back" data-index="${i}" aria-label="相手の伏せたカード${i + 1}"`, busy)).join('') : '<span class="table-symbol">♣</span>'}</div></div><div class="hand-heading">あなたの手札 <span>${s.hands[0].length}枚</span></div><div class="hand">${s.hands[0].map(playingCard).join('') || '<p>あがり！ 残りの対戦を見守ろう。</p>'}</div>${s.done ? result(s.loser === 0 ? 'ジョーカーはあなたでした！' : `${names[s.loser ?? 0]}がジョーカー！ あなたの勝ち！`) : ''}`;
}
function unoView(): string {
  const s = uno, done = s.winner !== null || s.tie, human = s.turn === 0 && !done && !busy;
  const top = s.discard[s.discard.length - 1];
  const shownTop = top.kind === 'number' ? {...top,color:s.color,value:s.topValue??top.value,expand:top.expand&&s.topValue!==top.value?{color:top.color!,value:top.value}:top.expand} : top;
  return `${opponents(s.hands.map(h => h.length), s.turn, s.shields, s.shieldPlus)}<div class="status" role="status">${done ? '勝負が決まりました。' : `${names[s.turn]}の番 · ${s.message}`}</div><div class="uno-table"><div><small>山札 ${s.drawPile.length}枚</small>${button('draw', '♣<span>1枚引く</span>', 'class="card-back draw-pile"', !!s.attack || !human || s.drawnId !== null || pending !== null)}</div><div><small>場のカード</small>${unoCard(shownTop)}</div></div><div class="color-status"><span class="color-dot ${s.color}"></span>今の色：${colorNames[s.color]}${s.topValue!==null?` · 数字${s.topValue}`:''} <span>${s.direction === 1 ? '時計回り ↻' : '反時計回り ↺'}</span></div><p class="hint">エクスパンド：${s.expandEnabled?s.expanded?'On':'Off':'無効'} · ＋印のカードに追加効果</p>${s.attack ? `<div class="expand-attack"><strong>ドロー攻撃 ${s.attack.count}枚</strong><p>On中の＋ドロー4で返すか、攻撃を受けます。${s.shields[s.turn]?'シールドは受けるときに発動します。':''}</p>${button('accept-attack',s.shields[0]?s.expanded&&s.shieldPlus[0]?'シールドで反射':'シールドで防ぐ':`${s.attack.count}枚引いて手番を休む`,'class="primary wide"',!human||pending!==null)}</div>` : ''}<div class="hand-heading">あなたの手札 <span>${s.hands[0].length}枚${s.shields[0] ? s.shieldPlus[0] ? ' · 🛡＋ 防御中' : ' · 🛡 防御中' : ''}</span></div><div class="hand uno-hand">${s.hands[0].map((c, i) => unoCard(c, i, !human || pending !== null || (s.drawnId !== null && c.id !== s.drawnId) || !canPlayUno(s,c))).join('')}</div>${s.drawnId !== null && human ? button('pass', '出さずに手番を終了', 'class="secondary wide"', pending !== null) : ''}<p class="hint">手札は横にスワイプできます · 明るいカードが出せます</p>${done ? result(s.tie ? '引き分け！' : `${names[s.winner!]}の勝ち！`) : ''}${pending !== null ? choicesView() : ''}`;
}
function choicesView(): string {
  const card = uno.hands[0][pending!], numeric = card.kind === 'number';
  return `<div class="choice-panel" role="dialog" aria-modal="true" aria-labelledby="choice-title"><h2 id="choice-title">${unoLabel(card)}を使う</h2>${numeric ? `<p>出す色・数字を選んでください</p><div class="face-choices">${(['base','expand'] as const).map(face=>button('face',face==='base'?`${colorNames[card.color!]} ${card.value}（元の面）`:`${colorNames[card.expand!.color!]} ${card.expand!.value}（追加面）`,`data-face="${face}" class="${selectedFace===face?'selected':''}" aria-pressed="${selectedFace===face}"`,!canPlayUno(uno,card,face))).join('')}</div>` : `<p>次の色を選んでください</p><div class="color-choices">${colors.map(c=>button('color',colorNames[c],`class="${c} ${selectedColor===c?'selected':''}" data-color="${c}" aria-pressed="${selectedColor===c}"`)).join('')}</div>`}${(card.kind === 'swap'||card.kind==='target') ? `<p>${card.kind==='target'?'手番を移す人':'交換する相手'}</p><div class="target-choices">${(card.kind==='target'?[0,1,2,3]:[1,2,3]).map(p=>button('target',`${names[p]} (${uno.hands[p].length}枚)`,`data-target="${p}" class="${selectedTarget===p?'selected':''}" aria-pressed="${selectedTarget===p}"`)).join('')}</div>` : ''}${button('confirm','このカードを出す','class="primary wide"',numeric?!selectedFace:!selectedColor||((card.kind==='swap'||card.kind==='target')&&selectedTarget===null))}${button('cancel','キャンセル','class="secondary wide"')}</div>`;
}
function daifugoView(): string {
  const s = daifugo;
  const selecting = s.phase === 'exchange' || s.phase === 'play' && s.turn === 0;
  const ownPosition = s.order.indexOf(0);
  const humanClass = s.previousOrder.length ? classNames[s.previousOrder.indexOf(0)] : '平民';
  const ranks = s.phase === 'done' ? `<div class="result"><small>ROUND ${s.round} FINISHED</small><h2>今回の順位</h2><ol class="rank-list">${s.order.map((p, i) => `<li><strong>${classNames[i]}</strong><span>${names[p]}${p === s.fallen ? ' · 都落ち' : ''}</span></li>`).join('')}</ol>${button('next-round', '次のラウンドへ', 'class="primary wide"')}${button('home', 'ゲームを選ぶ', 'class="secondary wide"')}</div>` : '';
  const canSubmit = s.phase === 'exchange' ? selectedCards.length === s.exchangeCount : selecting && canPlayDaifugo(s, s.hands[0], selectedCards);
  return `<div class="round-heading"><strong>ROUND ${s.round}</strong><span>${s.revolution ? '革命中 · 3が最強' : '通常 · 2が最強'}</span></div><div class="opponents">${[1, 2, 3].map(p => `<div class="opponent ${s.phase === 'play' && s.turn === p ? 'active' : ''}"><div class="avatar">${['S', 'M', 'R'][p - 1]}</div><strong>${names[p]}</strong><span>${p === s.fallen ? '都落ち' : s.order.includes(p) ? `${s.order.indexOf(p) + 1}位あがり` : `${s.hands[p].length}枚${s.passed[p] ? ' · パス' : ''}`}</span><small>${s.previousOrder.length ? classNames[s.previousOrder.indexOf(p)] : '平民'}</small></div>`).join('')}</div><div class="status" role="status">${s.phase === 'done' ? s.message : s.phase === 'exchange' ? `カード交換 · ${s.message}` : `${names[s.turn]}の番 · ${s.message}`}</div><div class="daifugo-table"><small>${s.phase === 'exchange' ? `前回の${humanClass}として、${classNames[3 - s.previousOrder.indexOf(0)]}に渡すカードを選ぼう` : s.table.length ? `場のカード · ${s.table.length}枚` : '場は空です · 好きな数字から出せます'}</small><div class="table-cards">${s.table.length ? s.table.map(playingCard).join('') : '<span class="table-symbol">♦</span>'}</div></div><div class="hand-heading">あなたの手札 <span>${s.fallen === 0 ? '都落ち' : ownPosition >= 0 ? `${ownPosition + 1}位あがり` : `${s.hands[0].length}枚 · ${humanClass}`}</span></div><div class="hand daifugo-hand">${s.hands[0].map(c => button('select-daifugo', `<span>${cardLabel(c)}</span>`, `class="playing-card ${c.suit === '♥' || c.suit === '♦' ? 'ink-red' : ''} ${selectedCards.includes(c.id) ? 'chosen' : ''}" data-id="${c.id}" aria-label="${cardLabel(c)}" aria-pressed="${selectedCards.includes(c.id)}"`, !selecting || busy)).join('') || '<p>残りの対戦を見守ろう。</p>'}</div>${s.phase !== 'done' ? `<div class="daifugo-actions">${button(s.phase === 'exchange' ? 'exchange-daifugo' : 'submit-daifugo', s.phase === 'exchange' ? `${selectedCards.length}/${s.exchangeCount}枚 · 交換する` : `${selectedCards.length}枚 · 出す`, 'class="primary"', !canSubmit)}${s.phase === 'play' ? button('pass-daifugo', 'パス', 'class="secondary"', !selecting || !s.table.length) : ''}${button('clear-selection', '選択解除', 'class="secondary"', !selectedCards.length)}</div><p class="hint">手札は横にスワイプ · 複数選んでから確定</p>` : ''}${ranks}`;
}
function rules(): string {
  const text = game === 'pointSevens' ? pointSevensRules : game === 'sevens' ? sevensRules : game === 'gin' ? ginRules : game === 'daifugo' ? '52枚・ジョーカーなし。通常は3→4→5→6→7→8→9→10→J→Q→K→A→2の順に強く、同じ数字1〜4枚を出します。場と同じ枚数で強い数字を出してください。4枚で革命、強さが反転し、再革命で戻ります。8で場を流し、出した人から再開（あがったら次の人）。パスすると場が流れるまで参加できません。前回の大富豪が最初にあがれなければ即都落ちし最下位です。2ラウンド目以降は大富豪と大貧民で2枚、富豪と貧民で1枚を交換。下位は通常順で最強、上位は任意カードを渡します。初回はダイヤ3の持ち主から、以降は前回の大貧民から開始。革命は毎ラウンドリセット。階段・縛り・11バック・あがり禁止はありません。' : game === 'memory' ? '24枚から同じ数字のペアを探します。ペアができたら続けてめくれます。獲得ペアが多い人の勝ち。AIは公開されたカードを覚えます。' : game === 'oldmaid' ? '同じ数字をペアで捨て、次の相手から1枚引きます。手札がなくなればあがり。最後にジョーカーを持った人が負けです。' : unoRules;
  return `<details class="rules"><summary>遊び方を見る</summary><p>${text}</p></details>`;
}
function render(): void {
  const handScroll = root.querySelector('.hand')?.scrollLeft ?? 0;
  root.innerHTML = `<header class="site-header"><button class="brand" data-action="home">♣ <span>ひとやすみカード部</span></button><span class="header-tag">SOLO PLAY</span></header><main>${game ? `<div class="game-header">${button('home', '← ゲーム一覧', 'class="back"')}<span>AI対戦</span><h1>${titles[game]}</h1>${button('restart', 'やり直す', 'class="restart"')}</div><section class="game-board">${game === 'memory' ? memoryView() : game === 'oldmaid' ? oldmaidView() : game === 'daifugo' ? daifugoView() : game === 'gin' ? ginView(gin, ginSelected) : game === 'sevens' ? sevensView(sevens) : game === 'pointSevens' ? pointSevensView(pointSevens, pointSelection) : unoView()}</section>${rules()}` : home()}</main><footer>ひとやすみカード部 <span>PLAY AT YOUR OWN PACE</span></footer>`;
  const handElement = root.querySelector('.hand');
  if (handElement) handElement.scrollLeft = handScroll;
  if (pending !== null) root.querySelector<HTMLButtonElement>('.choice-panel button')?.focus();
}
function flip(index: number): void {
  if (!reveal(memory, index)) return;
  if (memory.open.length === 2) {
    busy = true; render(); later(() => { resolvePair(memory); busy = false; render(); schedule(); }, 1000);
  } else { render(); if (memory.turn === 1) schedule(); }
}
function schedule(): void {
  if (game === 'pointSevens' && pointSevens.phase !== 'done' && pointSevens.turn !== 0) later(() => {
    const p = pointSevens.turn;
    if (pointSevens.phase === 'choice') choosePointSpecial(pointSevens, pointBonusChoice(pointSevens));
    else {
      const special = pointSpecialMove(pointSevens);
      if (special) usePointSpecial(pointSevens, special.id, special.args);
      else {
        const id = pointSevensMove(pointSevens.hands[p], pointSevens.board, { forced: pointSevens.forced || pointSevens.phase !== 'play' || pointSevens.placedThisTurn > 0, lastPassBoardSize: pointSevens.lastPassBoardSize[p], fixedPoints: pointFixedPoints(pointSevens,p) });
        if (id) playPointSevens(pointSevens, id);
        else if (pointSevens.phase === 'interrupt') skipPointInterrupt(pointSevens);
        else if (pointSevens.placedThisTurn > 0) endPointSevensTurn(pointSevens);
        else passPointSevens(pointSevens);
      }
    }
    render(); schedule();
  });
  if (game === 'sevens' && !sevens.done && sevens.turn !== 0) later(() => {
    const id = sevensMove(sevens.hands[sevens.turn], sevens.board);
    if (id) playSevens(sevens, id); else passSevens(sevens);
    render(); schedule();
  });
  if (game === 'gin' && gin.turn === 1 && !['roundOver', 'matchOver'].includes(gin.phase)) later(() => {
    if (gin.phase === 'discard') {
      const move = chooseGinDiscard(gin.hands[1], gin.forbiddenDiscard);
      discardGin(gin, move.id, move.points <= 10);
    } else if (gin.phase === 'opening') {
      if (shouldTakeGinDiscard(gin.hands[1], gin.discard.at(-1)!)) drawGin(gin, 'discard'); else declineGin(gin);
    } else {
      const takeUpcard = !gin.mustStock && !!gin.discard.length && shouldTakeGinDiscard(gin.hands[1], gin.discard.at(-1)!);
      drawGin(gin, takeUpcard ? 'discard' : 'stock');
    }
    render(); schedule();
  });
  if (game === 'daifugo' && daifugo.phase === 'play' && daifugo.turn !== 0) later(() => {
    const ids = daifugoMove(daifugo.hands[daifugo.turn], daifugo.table, daifugo.revolution);
    if (ids.length) playDaifugo(daifugo, ids); else passDaifugo(daifugo);
    render(); schedule();
  });
  if (game === 'memory' && !memory.done && memory.turn === 1 && !busy) later(() => flip(memoryMove(memory)));
  if (game === 'oldmaid' && !oldmaid.done && oldmaid.turn !== 0) later(() => {
    const count = oldmaid.hands[nextPlayer(oldmaid, oldmaid.turn)].length;
    takeCard(oldmaid, Math.floor(Math.random() * count)); render(); schedule();
  });
  if (game === 'uno' && uno.winner === null && !uno.tie && uno.turn !== 0) later(() => {
    const move = unoMove(uno.hands[uno.turn], uno.discard[uno.discard.length - 1], uno.color, uno.hands.map(h => h.length), uno.turn, uno.drawnId, uno);
    if (move.index !== undefined) playUno(uno, move.index, move.color, move.target, Math.random, move.face);
    else if (uno.attack) acceptUnoAttack(uno); else if (uno.drawnId !== null) passUno(uno); else drawTurn(uno);
    render(); schedule();
  });
}
root.addEventListener('change', event => { const input=event.target as HTMLInputElement; if(input.id==='custom')custom=input.checked;if(input.id==='expand'){expandEnabled=input.checked;render();} });
root.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(input.id==='expand-rate'){expandRate=Number(input.value);const out=root.querySelector('#expand-rate-value');if(out)out.textContent=`${expandRate}％`;}});
root.addEventListener('click', event => {
  const element = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!element || element.disabled) return;
  const action = element.dataset.action, index = Number(element.dataset.index);
  if (action === 'home') { reset(); game = null; render(); return; }
  if (action === 'start') { start(element.dataset.game as Game); return; }
  if (action === 'restart' && game) { if (window.confirm('現在のゲームを終了して、最初から遊びますか？')) start(game); return; }
  if (busy) return;
  if (game === 'pointSevens' && action === 'point-next' && pointSevens.phase === 'done') { reset(); pointSevens = nextPointSevensRound(pointSevens); }
  if (game === 'pointSevens' && pointSevens.phase !== 'done' && pointSevens.turn === 0) {
    if (action === 'point-bonus') choosePointSpecial(pointSevens, element.dataset.kind as PointSpecialKind);
    if (action === 'point-special') pointSelection = { specialId: element.dataset.id!, cardId: null, target: null };
    if (action === 'point-card') pointSelection.cardId = element.dataset.id!;
    if (action === 'point-target') pointSelection.target = Number(element.dataset.target);
    if (action === 'point-cancel') pointSelection = { specialId: null, cardId: null, target: null };
    if (action === 'point-use-special' && pointSelection.specialId && usePointSpecial(pointSevens, pointSelection.specialId, { cardId: pointSelection.cardId ?? undefined, target: pointSelection.target ?? undefined })) pointSelection = { specialId: null, cardId: null, target: null };
    if (action === 'point-end') endPointSevensTurn(pointSevens);
    if (action === 'point-interrupt-end') skipPointInterrupt(pointSevens);
    if (action === 'point-sevens-play') playPointSevens(pointSevens, element.dataset.id!);
    if (action === 'point-sevens-pass') passPointSevens(pointSevens);
  }
  if (game === 'sevens' && !sevens.done && sevens.turn === 0) {
    if (action === 'sevens-play') playSevens(sevens, element.dataset.id!);
    if (action === 'sevens-pass') passSevens(sevens);
  }
  if (game === 'gin') {
    if (action === 'gin-next' && gin.phase === 'roundOver') { reset(); gin = nextGinRound(gin); }
    if (gin.turn === 0) {
      if (action === 'gin-decline') declineGin(gin);
      if (action === 'gin-stock') drawGin(gin, 'stock');
      if (action === 'gin-upcard') drawGin(gin, 'discard');
      if (action === 'gin-select' && gin.phase === 'discard' && element.dataset.id !== gin.forbiddenDiscard) ginSelected = ginSelected === element.dataset.id ? null : element.dataset.id!;
      if ((action === 'gin-discard' || action === 'gin-knock') && ginSelected && discardGin(gin, ginSelected, action === 'gin-knock')) ginSelected = null;
    }
  }
  if (game === 'daifugo') {
    if (action === 'next-round' && daifugo.phase === 'done') { reset(); daifugo = nextRound(daifugo); }
    if (action === 'select-daifugo' && (daifugo.phase === 'exchange' || daifugo.phase === 'play' && daifugo.turn === 0)) {
      const id = element.dataset.id!;
      selectedCards = selectedCards.includes(id) ? selectedCards.filter(c => c !== id) : [...selectedCards, id];
    }
    if (action === 'clear-selection') selectedCards = [];
    if (action === 'submit-daifugo' && daifugo.turn === 0 && playDaifugo(daifugo, selectedCards)) selectedCards = [];
    if (action === 'exchange-daifugo' && exchangeCards(daifugo, selectedCards)) selectedCards = [];
    if (action === 'pass-daifugo' && daifugo.turn === 0 && passDaifugo(daifugo)) selectedCards = [];
  }
  if (action === 'flip' && game === 'memory' && memory.turn === 0) { flip(index); return; }
  if (action === 'take' && game === 'oldmaid' && oldmaid.turn === 0) takeCard(oldmaid, index);
  if (game === 'uno' && uno.turn === 0) {
    if (action === 'play') {
      const card = uno.hands[0][index];
      if (!canPlayUno(uno,card)) return;
      if (card.color === null || uno.expanded && card.kind==='number' && card.expand) { pending = index; selectedColor = null; selectedTarget = null; selectedFace = null; }
      else playUno(uno, index);
    }
    if (action === 'accept-attack') acceptUnoAttack(uno);
    if (action === 'draw') drawTurn(uno);
    if (action === 'pass') passUno(uno);
    if (action === 'face') selectedFace=element.dataset.face as UnoFace;
    if (action === 'color') selectedColor = element.dataset.color as Color;
    if (action === 'target') selectedTarget = Number(element.dataset.target);
    if (action === 'cancel') pending = null;
    if (action === 'confirm' && pending !== null && (selectedColor || selectedFace)) {
      if (playUno(uno, pending, selectedColor ?? undefined, selectedTarget ?? undefined, Math.random, selectedFace ?? 'base')) pending = null;
    }
  }
  render(); schedule();
});
root.addEventListener('keydown', event => {
  if (pending === null) return;
  if (event.key === 'Escape') { pending = null; render(); return; }
  if (event.key === 'Tab') {
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.choice-panel button:not(:disabled)'));
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
render();
