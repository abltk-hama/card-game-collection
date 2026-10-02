import './style.css';
import { names, cardLabel, type PlayingCard } from './common.ts';
import { createMemory, reveal, resolvePair, memoryMove, type MemoryState } from './memory.ts';
import { createOldMaid, nextPlayer, takeCard, type OldMaidState } from './oldmaid.ts';
import { createUno, canPlay, playUno, drawTurn, passUno, unoLabel, unoMove, colors, type Color, type UnoCard, type UnoState } from './uno.ts';
import { createDaifugo, nextRound, playDaifugo, passDaifugo, canPlayDaifugo, exchangeCards, daifugoMove, classNames, type DaifugoState } from './daifugo.ts';
import { createGin, nextGinRound, declineGin, drawGin, discardGin, chooseGinDiscard, shouldTakeGinDiscard, type GinState } from './gin.ts';
import { ginView, ginRules } from './gin-view.ts';

import { createSevens, playSevens, passSevens, sevensMove, type SevensState } from './sevens.ts';
import { sevensView, sevensRules } from './sevens-view.ts';

type Game = 'memory' | 'oldmaid' | 'uno' | 'daifugo' | 'gin' | 'sevens';
const root = document.querySelector<HTMLDivElement>('#app')!;
let game: Game | null = null;
let memory: MemoryState;
let oldmaid: OldMaidState;
let uno: UnoState;
let daifugo: DaifugoState;
let gin: GinState;
let sevens: SevensState;
let ginSelected: string | null = null;
let selectedCards: string[] = [];
let custom = true;
let pending: number | null = null;
let selectedColor: Color | null = null;
let selectedTarget: number | null = null;
let busy = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
const colorNames: Record<Color, string> = { red: '赤', yellow: '黄', green: '緑', blue: '青' };
const titles: Record<Game, string> = { memory: '神経衰弱', oldmaid: 'ババ抜き', uno: 'カラーマッチ', daifugo: '大富豪', gin: 'ジンラミー', sevens: '七並べ' };
function later(action: () => void, delay = 800): void {
  const token = generation;
  clearTimeout(timer); timer = setTimeout(() => { if (token === generation) action(); }, delay);
}
function reset(): void { generation++; clearTimeout(timer); busy = false; pending = null; selectedColor = null; selectedTarget = null; selectedCards = []; ginSelected = null; }
function start(g: Game): void {
  reset(); game = g;
  if (g === 'memory') memory = createMemory();
  if (g === 'oldmaid') oldmaid = createOldMaid();
  if (g === 'uno') uno = createUno(custom);
  if (g === 'daifugo') daifugo = createDaifugo();
  if (g === 'gin') gin = createGin();
  if (g === 'sevens') sevens = createSevens();
  render(); schedule();
}
function button(action: string, label: string, extra = '', disabled = false): string {
  return `<button data-action="${action}" ${extra} ${disabled ? 'disabled' : ''}>${label}</button>`;
}
function playingCard(c: PlayingCard): string {
  return `<span class="playing-card ${c.suit === '♥' || c.suit === '♦' ? 'ink-red' : ''}">${cardLabel(c)}</span>`;
}
function unoCard(c: UnoCard, index?: number, disabled = false): string {
  const label = `${c.color ? colorNames[c.color] : 'ワイルド'} ${unoLabel(c)}`;
  const inside = `<span class="card-corner">${c.color ? colorNames[c.color] : '✦'}</span><strong>${unoLabel(c)}</strong><span class="card-foot">${c.kind === 'number' ? 'NUMBER' : 'ACTION'}</span>`;
  return index === undefined ? `<div class="uno-card ${c.color ?? 'wild'}" aria-label="${label}">${inside}</div>` : `<button class="uno-card ${c.color ?? 'wild'}" data-action="play" data-index="${index}" aria-label="${label}" ${disabled ? 'disabled' : ''}>${inside}</button>`;
}
function home(): string {
  return `<div class="home"><div class="eyebrow">A LITTLE BREAK, A LITTLE PLAY</div><h1>ひとやすみ<br>カード部<span>♣</span></h1><p class="intro">ひとりでも、テーブルはにぎやか。<br>好きなカードで、AIとひと勝負。</p><div class="section-label">今日、何で遊ぶ？ <span>06 GAMES</span></div><div class="game-list">
    <button class="game-tile" data-action="start" data-game="memory"><span class="tile-icon">♠</span><span><small>01 / MEMORY</small><strong>神経衰弱</strong><em>めくって、覚えて、ペアを探そう。</em><i>24枚 · AIと1対1</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="oldmaid"><span class="tile-icon coral">★</span><span><small>02 / OLD MAID</small><strong>ババ抜き</strong><em>最後のジョーカー、誰の手に？</em><i>あなた＋AI3人</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="uno"><span class="tile-icon gold">↔</span><span><small>03 / COLOR MATCH</small><strong>カラーマッチ</strong><em>色をつないで、逆転の一枚。</em><i>UNO風 · あなた＋AI3人</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="daifugo"><span class="tile-icon royal">♦</span><span><small>04 / DAIFUGO</small><strong>大富豪</strong><em>革命の一手で、頂点をつかもう。</em><i>革命・8切り・都落ち · AI3人</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="gin"><span class="tile-icon teal">♥</span><span><small>05 / GIN RUMMY</small><strong>ジンラミー</strong><em>組をつくって、ノックの勝負。</em><i>100点先取 · AIと1対1</i></span><b>↗</b></button>
    <button class="game-tile" data-action="start" data-game="sevens"><span class="tile-icon terracotta">7</span><span><small>06 / SEVENS</small><strong>七並べ</strong><em>つないで、待って、先にあがろう。</em><i>パス3回まで · AI3人</i></span><b>↗</b></button>
  </div><label class="custom-option"><span><strong>カラーマッチの独自カード</strong><small>交換 / シールド / 全員ドロー</small></span><input id="custom" type="checkbox" ${custom ? 'checked' : ''} aria-label="独自カードを使う"></label><div class="home-note">✦ 登録なし。AI対戦はブラウザーの中で。</div></div>`;
}
function opponents(counts: number[], turn: number, shields?: boolean[]): string {
  return `<div class="opponents">${counts.slice(1).map((count, i) => `<div class="opponent ${turn === i + 1 ? 'active' : ''}"><div class="avatar">${['S', 'M', 'R'][i]}</div><strong>${names[i + 1]}</strong><span>${count ? `${count}枚` : 'あがり'}${shields?.[i + 1] ? ' · 🛡' : ''}</span></div>`).join('')}</div>`;
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
  return `${opponents(s.hands.map(h => h.length), s.turn, s.shields)}<div class="status" role="status">${done ? '勝負が決まりました。' : `${names[s.turn]}の番 · ${s.message}`}</div><div class="uno-table"><div><small>山札 ${s.drawPile.length}枚</small>${button('draw', '♣<span>1枚引く</span>', 'class="card-back draw-pile"', !human || s.drawnId !== null || pending !== null)}</div><div><small>場のカード</small>${unoCard(top)}</div></div><div class="color-status"><span class="color-dot ${s.color}"></span>今の色：${colorNames[s.color]} <span>${s.direction === 1 ? '時計回り ↻' : '反時計回り ↺'}</span></div><div class="hand-heading">あなたの手札 <span>${s.hands[0].length}枚${s.shields[0] ? ' · 🛡 防御中' : ''}</span></div><div class="hand uno-hand">${s.hands[0].map((c, i) => unoCard(c, i, !human || pending !== null || (s.drawnId !== null && c.id !== s.drawnId) || !canPlay(c, s.hands[0], top, s.color))).join('')}</div>${s.drawnId !== null && human ? button('pass', '出さずに手番を終了', 'class="secondary wide"', pending !== null) : ''}<p class="hint">手札は横にスワイプできます · 明るいカードが出せます</p>${done ? result(s.tie ? '引き分け！' : `${names[s.winner!]}の勝ち！`) : ''}${pending !== null ? choicesView() : ''}`;
}
function choicesView(): string {
  const card = uno.hands[0][pending!];
  return `<div class="choice-panel" role="dialog" aria-modal="true" aria-labelledby="choice-title"><h2 id="choice-title">${unoLabel(card)}を使う</h2><p>次の色を選んでください</p><div class="color-choices">${colors.map(c => button('color', colorNames[c], `class="${c} ${selectedColor === c ? 'selected' : ''}" data-color="${c}" aria-pressed="${selectedColor === c}"`)).join('')}</div>${card.kind === 'swap' ? `<p>交換する相手</p><div class="target-choices">${[1, 2, 3].map(p => button('target', `${names[p]} (${uno.hands[p].length}枚)`, `data-target="${p}" class="${selectedTarget === p ? 'selected' : ''}" aria-pressed="${selectedTarget === p}"`)).join('')}</div>` : ''}${button('confirm', 'このカードを出す', 'class="primary wide"', !selectedColor || (card.kind === 'swap' && selectedTarget === null))}${button('cancel', 'キャンセル', 'class="secondary wide"')}</div>`;
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
  const text = game === 'sevens' ? sevensRules : game === 'gin' ? ginRules : game === 'daifugo' ? '52枚・ジョーカーなし。通常は3→4→5→6→7→8→9→10→J→Q→K→A→2の順に強く、同じ数字1〜4枚を出します。場と同じ枚数で強い数字を出してください。4枚で革命、強さが反転し、再革命で戻ります。8で場を流し、出した人から再開（あがったら次の人）。パスすると場が流れるまで参加できません。前回の大富豪が最初にあがれなければ即都落ちし最下位です。2ラウンド目以降は大富豪と大貧民で2枚、富豪と貧民で1枚を交換。下位は通常順で最強、上位は任意カードを渡します。初回はダイヤ3の持ち主から、以降は前回の大貧民から開始。革命は毎ラウンドリセット。階段・縛り・11バック・あがり禁止はありません。' : game === 'memory' ? '24枚から同じ数字のペアを探します。ペアができたら続けてめくれます。獲得ペアが多い人の勝ち。AIは公開されたカードを覚えます。' : game === 'oldmaid' ? '同じ数字をペアで捨て、次の相手から1枚引きます。手札がなくなればあがり。最後にジョーカーを持った人が負けです。' : '色か数字・記号が同じカードを出します。引いた1枚が出せる場合は出すか終了を選べます。+2・+4は次の人が引いて手番を休み、積み重ねはできません。+4は今の色が手札にない場合だけ使えます。UNO宣言・チャレンジはありません。交換は相手と残りの手札を交換。防御はドローを1回防ぎます（手番の休みは防ぎません）。全員+1は自分以外が1枚引きます。効果処理後に手札が0枚なら勝ち。山札が枯れたら捨て札を再利用します。';
  return `<details class="rules"><summary>遊び方を見る</summary><p>${text}</p></details>`;
}
function render(): void {
  const handScroll = root.querySelector('.hand')?.scrollLeft ?? 0;
  root.innerHTML = `<header class="site-header"><button class="brand" data-action="home">♣ <span>ひとやすみカード部</span></button><span class="header-tag">SOLO PLAY</span></header><main>${game ? `<div class="game-header">${button('home', '← ゲーム一覧', 'class="back"')}<span>AI対戦</span><h1>${titles[game]}</h1>${button('restart', 'やり直す', 'class="restart"')}</div><section class="game-board">${game === 'memory' ? memoryView() : game === 'oldmaid' ? oldmaidView() : game === 'daifugo' ? daifugoView() : game === 'gin' ? ginView(gin, ginSelected) : game === 'sevens' ? sevensView(sevens) : unoView()}</section>${rules()}` : home()}</main><footer>ひとやすみカード部 <span>PLAY AT YOUR OWN PACE</span></footer>`;
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
    const move = unoMove(uno.hands[uno.turn], uno.discard[uno.discard.length - 1], uno.color, uno.hands.map(h => h.length), uno.turn, uno.drawnId);
    if (move.index !== undefined) playUno(uno, move.index, move.color, move.target);
    else if (uno.drawnId !== null) passUno(uno); else drawTurn(uno);
    render(); schedule();
  });
}
root.addEventListener('change', event => { if ((event.target as HTMLElement).id === 'custom') custom = (event.target as HTMLInputElement).checked; });
root.addEventListener('click', event => {
  const element = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!element || element.disabled) return;
  const action = element.dataset.action, index = Number(element.dataset.index);
  if (action === 'home') { reset(); game = null; render(); return; }
  if (action === 'start') { start(element.dataset.game as Game); return; }
  if (action === 'restart' && game) { if (window.confirm('現在のゲームを終了して、最初から遊びますか？')) start(game); return; }
  if (busy) return;
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
      if (card.color === null) { pending = index; selectedColor = null; selectedTarget = null; }
      else playUno(uno, index);
    }
    if (action === 'draw') drawTurn(uno);
    if (action === 'pass') passUno(uno);
    if (action === 'color') selectedColor = element.dataset.color as Color;
    if (action === 'target') selectedTarget = Number(element.dataset.target);
    if (action === 'cancel') pending = null;
    if (action === 'confirm' && pending !== null && selectedColor) {
      if (playUno(uno, pending, selectedColor, selectedTarget ?? undefined)) pending = null;
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
