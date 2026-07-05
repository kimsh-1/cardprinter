// card-shorts E 패턴(아이콘세트)용 SVG 아이콘 라이브러리.
// 24x24 viewBox, stroke 기반(stroke-width 2, round cap/join), fill=none — 라운드·미니멀 스타일.
// 색은 currentColor로 상속 — 카드 토큰(--acc/--ink)이 실제 색을 지배한다.
// 외부 의존성 없음, 전부 손으로 좌표를 잡은 자작 path/primitive.

const RAW = {
  bulb: `
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>
    <path d="M9 18h6"/>
    <path d="M10 22h4"/>
  `,
  brain: `
    <path d="M12 4c-1.5 0-2.8.8-3.4 2A3 3 0 0 0 7 11a3 3 0 0 0 1.6 5.4A3.5 3.5 0 0 0 12 20"/>
    <path d="M12 4c1.5 0 2.8.8 3.4 2A3 3 0 0 1 17 11a3 3 0 0 1-1.6 5.4A3.5 3.5 0 0 1 12 20"/>
    <path d="M12 4v16"/>
  `,
  "chart-up": `
    <polyline points="3 20 8 14 12 17 20 6"/>
    <polyline points="15 6 20 6 20 11"/>
  `,
  "chart-bar": `
    <line x1="4" y1="20" x2="20" y2="20"/>
    <line x1="7" y1="20" x2="7" y2="12"/>
    <line x1="12" y1="20" x2="12" y2="7"/>
    <line x1="17" y1="20" x2="17" y2="15"/>
  `,
  clock: `
    <circle cx="12" cy="12" r="9"/>
    <line x1="12" y1="7" x2="12" y2="12"/>
    <line x1="12" y1="12" x2="15.5" y2="14"/>
  `,
  shield: `
    <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"/>
  `,
  warning: `
    <path d="M12 3l10 18H2z"/>
    <line x1="12" y1="9" x2="12" y2="14"/>
    <line x1="12" y1="17" x2="12" y2="17.01"/>
  `,
  check: `
    <polyline points="4 12 10 18 20 6"/>
  `,
  x: `
    <line x1="5" y1="5" x2="19" y2="19"/>
    <line x1="19" y1="5" x2="5" y2="19"/>
  `,
  search: `
    <circle cx="11" cy="11" r="7"/>
    <line x1="16.5" y1="16.5" x2="21" y2="21"/>
  `,
  gear: `
    <circle cx="12" cy="12" r="3.5"/>
    <line x1="12" y1="2" x2="12" y2="5"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="5" y2="12"/>
    <line x1="19" y1="12" x2="22" y2="12"/>
    <line x1="4.9" y1="4.9" x2="7" y2="7"/>
    <line x1="17" y1="17" x2="19.1" y2="19.1"/>
    <line x1="4.9" y1="19.1" x2="7" y2="17"/>
    <line x1="17" y1="7" x2="19.1" y2="4.9"/>
  `,
  book: `
    <path d="M4 4.5C4 3.7 4.7 3 5.5 3H12v18H5.5c-.8 0-1.5-.7-1.5-1.5v-15z"/>
    <path d="M20 4.5c0-.8-.7-1.5-1.5-1.5H12v18h6.5c.8 0 1.5-.7 1.5-1.5v-15z"/>
  `,
  chat: `
    <path d="M21 12c0 4.4-4 8-9 8-1.1 0-2.2-.2-3.2-.5L3 21l1.6-4.8C3.6 14.9 3 13.5 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"/>
  `,
  heart: `
    <path d="M12 21s-7-4.5-9.5-9C.8 8.4 2 4.5 5.5 4c2-.3 3.8.7 4.5 2.3C10.7 4.7 12.5 3.7 14.5 4c3.5.5 4.7 4.4 3 8-2.5 4.5-9.5 9-9.5 9z"/>
  `,
  star: `
    <path d="M12 2l3 6.5 7 .8-5.2 4.7 1.4 6.9L12 17.5 5.8 21l1.4-6.9L2 9.3l7-.8L12 2z"/>
  `,
  money: `
    <circle cx="12" cy="12" r="9"/>
    <path d="M9 15c0 1.1 1.3 2 3 2s3-.9 3-2-1.3-1.8-3-2-3-.9-3-2 1.3-2 3-2 3 .9 3 2"/>
    <line x1="12" y1="6" x2="12" y2="8"/>
    <line x1="12" y1="16" x2="12" y2="18"/>
  `,
  target: `
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1"/>
  `,
  link: `
    <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5"/>
    <path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5"/>
  `,
  layers: `
    <polygon points="12 3 21 8 12 13 3 8"/>
    <polyline points="3 13 12 18 21 13"/>
    <polyline points="3 17.5 12 22 21 17.5"/>
  `,
  sparkle: `
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>
    <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/>
  `,
};

function wrap(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner.trim()}</svg>`;
}

export const ICONS = Object.fromEntries(
  Object.entries(RAW).map(([name, inner]) => [name, wrap(inner)])
);

export function icon(name, { size = 96, stroke = "currentColor" } = {}) {
  const raw = ICONS[name];
  if (!raw) return null;
  return raw
    .replace("<svg ", `<svg width="${size}" height="${size}" aria-hidden="true" `)
    .replace('stroke="currentColor"', `stroke="${stroke}"`);
}
