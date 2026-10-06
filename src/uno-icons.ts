import type { Kind } from './uno.ts';
// 単色の記号は色やエクスパンド状態が変わっても同じ輪郭で識別する。
export function unoIcon(kind: Kind, enhanced = false): string {
 const shapes: Partial<Record<Kind,string>> = {
  swap:'<path d="M12 21h38l-8-8M52 43H14l8 8"/><rect x="23" y="26" width="18" height="12" rx="2"/>',
  shield:'<path d="M32 9 13 17v15c0 11 9 19 19 23 10-4 19-12 19-23V17Z"/>',
  all:'<circle cx="12" cy="17" r="4"/><circle cx="32" cy="17" r="4"/><circle cx="52" cy="17" r="4"/><path d="M5 29v-2c0-7 14-7 14 0v2M25 29v-2c0-7 14-7 14 0v2M45 29v-2c0-7 14-7 14 0v2M12 49V37m20 12V37m20 12V37"/><rect x="7" y="49" width="10" height="9" rx="2"/><rect x="27" y="49" width="10" height="9" rx="2"/><rect x="47" y="49" width="10" height="9" rx="2"/>',
  target:'<circle cx="32" cy="32" r="19"/><circle cx="32" cy="32" r="7"/><path d="M32 5v14m0 26v14M5 32h14m26 0h14"/>',
  wild:'<rect x="10" y="14" width="25" height="37" rx="4"/><path d="m33 14 19-5v37l-19 5M19 26h11m-5-5v10M39 26l8-2m-4-4v9"/>',
  skip:'<circle cx="32" cy="32" r="22"/><path d="m16 16 32 32"/>',
  reverse:'<path d="M12 23h38l-10-10M52 41H14l10 10"/>',
  draw2:'<rect x="13" y="12" width="25" height="36" rx="4"/><rect x="26" y="20" width="25" height="36" rx="4"/>',
  draw4:'<rect x="9" y="10" width="23" height="34" rx="4"/><rect x="21" y="16" width="23" height="34" rx="4"/><rect x="33" y="22" width="23" height="34" rx="4"/>'
 };
 if(kind==='number')return '';
 const reflection=kind==='shield'&&enhanced?'<path d="m21 38 11-11 11 11m-11-11v20"/>':'';
 return `<svg class="uno-symbol" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[kind]??''}${reflection}</svg>`;
}
