import { cardLabel, names } from './common.ts';
import { sevensSuits } from './sevens.ts';
import { canPassPointSevens, pointSevensRanking, pointSevensValue, type PointSevensState } from './point-sevens.ts';

export const pointSevensRules = '独自ルールの七並べ。自分＋AI3人、52枚・ジョーカーなし。7を自動配置して所有者に各＋2点、♦7の持ち主から開始。7から連続する位置に出すと＋2点。空いているA・K、またはA・K側から内側へ伸びる未接続の並びに出すと＋1点。穴を埋めて7側と接続する一手は＋2点、過去の得点は変更しません。AとKはつながりません。パスは毎回－1点で、脱落・回数制限なし。対戦中の全員が連続パスすると強制配置になり、出せる人は必ず1枚出すまで続きます。出せない人のパスも－1点。配置で連続パスと強制配置をリセット。最後の1人は1枚出す最終手番の後、残り手札1枚につき－1点で終了。合計点順、同点はあがった順です。';
export function pointSevensView(s: PointSevensState): string {
  const human = s.turn === 0 && s.phase !== 'done', laid = new Set(s.board.map(c => c.id));
  const values = new Map(s.hands[0].map(c => [c.id, pointSevensValue(s.board, c)]));
  const ranks = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const board = sevensSuits.map(suit => `<div class="sevens-row ${suit === '♥' || suit === '♦' ? 'red-row' : ''}" role="group" aria-label="${suit}の場"><strong aria-hidden="true">${suit}</strong><div>${Array.from({ length: 13 }, (_, i) => {
    const rank = i + 1, id = `${suit}${rank}`, value = values.get(id) ?? 0;
    return `<span class="sevens-cell ${laid.has(id) ? 'laid' : ''} ${rank === 7 ? 'seven' : ''} ${human && value ? 'available' : ''} ${human && value === 1 ? 'point-one' : ''}" aria-label="${suit} ${ranks[rank]} ${laid.has(id) ? '配置済み' : '空き'}${human && value ? ` ＋${value}点` : ''}">${ranks[rank]}</span>`;
  }).join('')}</div></div>`).join('');
  const rankList = s.phase === 'done' ? `<div class="result"><small>GAME FINISHED</small><h2>得点での順位</h2><ol class="rank-list">${pointSevensRanking(s).map((p, i) => {
    const placed = Object.values(s.placements).filter(v => v.player === p).reduce((sum, v) => sum + v.points, 0);
    return `<li><strong>${i + 1}位</strong><span>${names[p]} · ${s.scores[p]}点<small>配置＋${placed} ／ パス－${s.passes[p]} ／ 残り－${s.penalties[p]}</small></span></li>`;
  }).join('')}</ol><p class="hint">同点はあがった順で決定</p><button data-action="restart" class="primary wide">もう一度遊ぶ</button><button data-action="home" class="secondary wide">ゲームを選ぶ</button></div>` : '';
  return `<div class="round-heading"><strong>POINT SEVENS</strong><span>接続＋2 · 端側＋1</span></div><div class="point-scores">${[0, 1, 2, 3].map(p => `<div class="${s.phase !== 'done' && s.turn === p ? 'active' : ''}"><small>${names[p]}</small><strong>${s.scores[p]}<small>点</small></strong><span>${s.finishOrder.includes(p) ? `${s.finishOrder.indexOf(p) + 1}番あがり` : `${s.hands[p].length}枚`}<br>パス${s.passes[p]}回</span></div>`).join('')}</div><div class="status" role="status">${s.phase === 'done' ? s.message : `${names[s.turn]}の番 · ${s.message}`}</div>${s.phase === 'final' ? '<p class="point-alert">最終手番：1枚出すと終了。残り手札は1枚につき－1点</p>' : s.forced ? '<p class="point-alert">強制配置中 · 出せるカードがあればパスできません</p>' : `<p class="hint">連続パス ${s.consecutivePasses} / ${4 - s.finishOrder.length}人 · 1周で強制配置</p>`}<div class="sevens-board" aria-label="ポイント七並べの場">${board}</div><p class="hint">金色の枠：＋2点 ／ 青色の枠：＋1点</p><div class="hand-heading">あなたの手札 <span>${s.hands[0].length}枚 · ${s.scores[0]}点</span></div><div class="hand sevens-hand point-hand">${s.hands[0].map(c => {
    const value = values.get(c.id)!;
    return `<button data-action="point-sevens-play" data-id="${c.id}" aria-label="${cardLabel(c)}${value ? ` ＋${value}点` : ''}" class="playing-card ${c.suit === '♥' || c.suit === '♦' ? 'ink-red' : ''} ${value === 1 ? 'point-one' : ''}" ${!human || !value ? 'disabled' : ''}><span>${cardLabel(c)}</span><small>${value ? `＋${value}点` : '待ち'}</small></button>`;
  }).join('') || '<p>あがりました。残りの対戦を見守ろう。</p>'}</div>${s.phase !== 'done' ? `<button data-action="point-sevens-pass" class="secondary wide" ${human && canPassPointSevens(s) ? '' : 'disabled'}>${s.finishOrder.includes(0) ? 'あがり · 観戦中' : s.phase === 'final' ? '最終手番は1枚出してください' : s.forced && !canPassPointSevens(s) ? '強制配置 · パス不可' : 'パス（－1点）'}</button>` : ''}<p class="hint">手札は横にスワイプ · 点数の付いたカードをタップして出す</p>${rankList}`;
}
