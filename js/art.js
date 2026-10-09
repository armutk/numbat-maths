// Original SVG illustration for Numbat Maths. One palette, rounded shapes, no gradients heavier than a soft shade.
const P = {
  fur: '#E8793A', furDeep: '#C9612B', furLight: '#FFB07A', cream: '#FFF1DA', belly: '#FFE6C7',
  ink: '#2B2740', dark: '#4A3030', white: '#FFFFFF',
  orange: '#FF8C42', green: '#3FB984', greenDeep: '#2D9668', blue: '#4D9EEB', blueDeep: '#2F7FCB',
  yellow: '#FFD23F', yellowDeep: '#E2B41A', pink: '#FF7EA8', purple: '#9B7CF0', red: '#F0605C',
  sand: '#F7E9D2', sandDeep: '#ECD9B8', grey: '#B9B4C9', brown: '#8B5E3C',
};

/* ---------- Pip the numbat (mascot) ---------- */
export function mascot(mood = 'happy', cls = 'mascot') {
  const cheer = mood === 'cheer';
  const think = mood === 'think';
  const kind = mood === 'kind';
  const sleepy = mood === 'sleepy';
  const eyeOpen = !sleepy;
  const mouth = cheer
    ? `<path d="M180 112 q10 16 22 2 q-6 10 -22 -2z" fill="${P.dark}"/><path d="M186 116 q6 6 12 1" stroke="${P.pink}" stroke-width="4" stroke-linecap="round" fill="none"/>`
    : think
    ? `<path d="M184 115 l12 -1" stroke="${P.dark}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`
    : kind
    ? `<path d="M183 114 q7 5 14 0" stroke="${P.dark}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`
    : `<path d="M182 112 q8 9 18 1" stroke="${P.dark}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
  const pupilDx = think ? -3 : 2, pupilDy = think ? -4 : 1;
  const eye = eyeOpen
    ? `<circle cx="160" cy="93" r="12" fill="${P.white}"/><circle cx="${160 + pupilDx}" cy="${93 + pupilDy}" r="6.5" fill="${P.ink}"/><circle cx="${163 + pupilDx}" cy="${90 + pupilDy}" r="2.4" fill="${P.white}"/>`
    : `<path d="M149 95 q11 8 22 0" stroke="${P.ink}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  const armL = `<ellipse cx="92" cy="166" rx="12" ry="22" transform="rotate(25 92 166)" fill="${P.fur}"/><ellipse cx="86" cy="183" rx="9" ry="6" fill="${P.furLight}"/>`;
  const armR = cheer
    ? `<ellipse cx="150" cy="166" rx="12" ry="20" transform="rotate(-40 150 166)" fill="${P.fur}"/><ellipse cx="160" cy="180" rx="9" ry="6" fill="${P.furLight}"/>`
    : `<ellipse cx="146" cy="170" rx="12" ry="20" transform="rotate(-20 146 170)" fill="${P.fur}"/><ellipse cx="150" cy="186" rx="9" ry="6" fill="${P.furLight}"/>`;
  const cheek = `<circle cx="178" cy="104" r="6" fill="${P.pink}" opacity="0.45"/>`;
  return `<svg class="${cls}" viewBox="0 0 240 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><clipPath id="nb-body"><ellipse cx="120" cy="150" rx="64" ry="52"/></clipPath></defs>
  <g class="tail">
    <path d="M78 166 C 30 150, 8 110, 26 64" stroke="${P.furDeep}" stroke-width="34" stroke-linecap="round" fill="none"/>
    <path d="M78 166 C 30 150, 8 110, 26 64" stroke="${P.fur}" stroke-width="22" stroke-linecap="round" fill="none"/>
    <g stroke="${P.cream}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.95">
      <path d="M48 150 q-10 -6 -16 -16"/><path d="M34 126 q-10 -4 -14 -14"/><path d="M26 98 q-8 -4 -8 -14"/><path d="M28 74 q-6 -4 -4 -12"/>
    </g>
  </g>
  <ellipse cx="124" cy="202" rx="70" ry="10" fill="${P.ink}" opacity="0.08"/>
  <ellipse cx="120" cy="150" rx="64" ry="52" fill="${P.fur}"/>
  <g clip-path="url(#nb-body)" stroke="${P.cream}" stroke-width="7" stroke-linecap="round" fill="none">
    <path d="M60 118 q14 20 10 50"/><path d="M76 108 q16 22 12 54"/><path d="M93 103 q16 24 12 58"/><path d="M110 101 q14 24 10 60"/>
  </g>
  <ellipse cx="126" cy="170" rx="40" ry="26" fill="${P.belly}"/>
  <ellipse cx="104" cy="200" rx="16" ry="8" fill="${P.dark}"/><ellipse cx="146" cy="200" rx="16" ry="8" fill="${P.dark}"/>
  ${armL}
  <circle cx="126" cy="60" r="15" fill="${P.fur}"/><circle cx="126" cy="60" r="8" fill="${P.furLight}"/>
  <circle cx="166" cy="56" r="15" fill="${P.fur}"/><circle cx="166" cy="56" r="8" fill="${P.furLight}"/>
  <circle cx="150" cy="96" r="44" fill="${P.fur}"/>
  <path d="M170 82 Q 212 90, 208 108 Q 200 122, 164 114 Z" fill="${P.fur}"/>
  <path d="M138 86 q26 2 50 14" stroke="${P.dark}" stroke-width="11" stroke-linecap="round" fill="none" opacity="0.9"/>
  <path d="M136 78 q26 0 50 10" stroke="${P.cream}" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="M142 98 q22 2 42 12" stroke="${P.cream}" stroke-width="4" stroke-linecap="round" fill="none"/>
  ${eye}
  <ellipse cx="206" cy="106" rx="7" ry="6" fill="${P.dark}"/>
  <circle cx="204" cy="104" r="2" fill="${P.white}" opacity="0.8"/>
  ${mouth}${cheek}
  ${armR}
</svg>`;
}

/* ---------- Countable items (viewBox 0 0 64 64) ---------- */
const wrap = (inner, extra = '') => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" ${extra} aria-hidden="true">${inner}</svg>`;

export const items = {
  cookie: () => wrap(`<circle cx="32" cy="32" r="27" fill="#C98A4B"/><circle cx="32" cy="32" r="22" fill="#E3A866"/>
    <circle cx="22" cy="26" r="4" fill="#5B3A22"/><circle cx="38" cy="22" r="3.5" fill="#5B3A22"/><circle cx="42" cy="36" r="4" fill="#5B3A22"/><circle cx="27" cy="40" r="3.5" fill="#5B3A22"/><circle cx="34" cy="31" r="2.5" fill="#5B3A22"/>`),
  apple: () => wrap(`<path d="M32 18 q-16 -8 -22 8 q-6 20 10 30 q6 4 12 0 q6 4 12 0 q16 -10 10 -30 q-6 -16 -22 -8z" fill="${P.red}"/>
    <path d="M32 18 q0 -8 6 -12" stroke="${P.brown}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M34 14 q10 -8 16 2 q-10 6 -16 -2z" fill="${P.green}"/><ellipse cx="24" cy="30" rx="3" ry="6" fill="#fff" opacity="0.35"/>`),
  strawberry: () => wrap(`<path d="M32 58 q-22 -14 -22 -32 q0 -12 22 -12 q22 0 22 12 q0 18 -22 32z" fill="${P.red}"/>
    <g fill="#FFF3B0"><circle cx="24" cy="30" r="2"/><circle cx="34" cy="26" r="2"/><circle cx="40" cy="36" r="2"/><circle cx="28" cy="42" r="2"/><circle cx="36" cy="48" r="2"/><circle cx="22" cy="20" r="1.6"/></g>
    <path d="M18 16 q14 -8 28 0 q-6 6 -14 6 q-8 0 -14 -6z" fill="${P.green}"/>`),
  star: () => wrap(`<path d="M32 6 l8 17 l18 2 l-13 12 l4 18 l-17 -9 l-17 9 l4 -18 l-13 -12 l18 -2z" fill="${P.yellow}" stroke="${P.yellowDeep}" stroke-width="3" stroke-linejoin="round"/>`),
  sock: (c = P.blue) => wrap(`<path d="M24 6 h18 v26 q0 10 10 14 q8 4 4 12 q-4 6 -12 2 l-14 -10 q-6 -4 -6 -12z" fill="${c}"/>
    <rect x="24" y="6" width="18" height="9" rx="3" fill="#fff" opacity="0.85"/><path d="M26 22 h14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.6"/><path d="M26 30 h14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`),
  egg: () => wrap(`<path d="M32 6 q18 0 20 28 q0 24 -20 24 q-20 0 -20 -24 q2 -28 20 -28z" fill="#FFF3D6" stroke="#E9CFA3" stroke-width="3"/><ellipse cx="26" cy="22" rx="4" ry="7" fill="#fff" opacity="0.7"/>`),
  lolly: (c = P.pink) => wrap(`<path d="M8 22 l12 6 v8 l-12 6 q4 -10 0 -20z" fill="${c}"/><path d="M56 22 l-12 6 v8 l12 6 q-4 -10 0 -20z" fill="${c}"/>
    <circle cx="32" cy="32" r="14" fill="${c}"/><path d="M24 24 q8 -4 16 0 M24 40 q8 4 16 0" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.7"/>`),
  flower: (c = P.purple) => wrap(`<g fill="${c}"><circle cx="32" cy="14" r="10"/><circle cx="50" cy="26" r="10"/><circle cx="44" cy="46" r="10"/><circle cx="20" cy="46" r="10"/><circle cx="14" cy="26" r="10"/></g><circle cx="32" cy="32" r="10" fill="${P.yellow}"/>`),
  muffin: () => wrap(`<path d="M14 30 h36 l-5 26 q-13 4 -26 0z" fill="#F2C7A1"/><path d="M12 24 q20 -18 40 0 q6 6 0 10 h-40 q-6 -4 0 -10z" fill="#B47A47"/><circle cx="26" cy="22" r="2.5" fill="#5B3A22"/><circle cx="38" cy="18" r="2.5" fill="#5B3A22"/><circle cx="44" cy="26" r="2.5" fill="#5B3A22"/>`),
  ball: (c = P.green) => wrap(`<circle cx="32" cy="32" r="26" fill="${c}"/><path d="M12 22 q20 10 40 0 M12 42 q20 -10 40 0" stroke="#fff" stroke-width="4" fill="none" opacity="0.7"/><ellipse cx="24" cy="22" rx="5" ry="8" fill="#fff" opacity="0.35"/>`),
  fish: (c = P.orange) => wrap(`<path d="M8 32 l14 -12 v24z" fill="${c}"/><ellipse cx="36" cy="32" rx="20" ry="14" fill="${c}"/><circle cx="46" cy="29" r="3" fill="${P.ink}"/><path d="M30 24 q6 8 0 16" stroke="#fff" stroke-width="3" fill="none" opacity="0.6"/>`),
  carrot: () => wrap(`<path d="M20 58 l26 -32 l-6 -8 l-32 30 q-2 10 12 10z" fill="${P.orange}"/><path d="M40 18 q4 -12 14 -12 q-2 10 -8 14 M46 24 q12 -4 14 6 q-10 2 -16 -2" fill="${P.green}"/>`),
  crayon: (c = P.blue) => wrap(`<rect x="24" y="14" width="16" height="42" rx="4" fill="${c}"/><path d="M24 16 l8 -10 l8 10z" fill="${c}"/><rect x="24" y="24" width="16" height="10" fill="#fff" opacity="0.5"/>`),
};

/** A tiny one-colour counter dot as SVG (used in explain sentences). */
export const dot = (c = P.orange) => wrap(`<circle cx="32" cy="32" r="22" fill="${c}"/><ellipse cx="24" cy="24" rx="5" ry="8" fill="#fff" opacity="0.35"/>`);

/* ---------- Friends (5 kids) ---------- */
const FRIENDS = [
  { skin: '#F4C9A5', hair: '#3B2B2B', top: P.blue, style: 'bob' },
  { skin: '#8D5A3C', hair: '#1E1414', top: P.green, style: 'curls' },
  { skin: '#F9D8C0', hair: '#E39A3B', top: P.pink, style: 'buns' },
  { skin: '#C68E6B', hair: '#2B1E1E', top: P.purple, style: 'short' },
  { skin: '#E8B592', hair: '#6B3A1E', top: P.yellow, style: 'ponytail' },
];
export function friend(i) {
  const f = FRIENDS[i % FRIENDS.length];
  const hair = {
    bob: `<path d="M14 30 q0 -22 18 -22 q18 0 18 22 v10 q-4 -14 -18 -14 q-14 0 -18 14z" fill="${f.hair}"/>`,
    curls: `<circle cx="18" cy="24" r="8" fill="${f.hair}"/><circle cx="32" cy="16" r="9" fill="${f.hair}"/><circle cx="46" cy="24" r="8" fill="${f.hair}"/><circle cx="24" cy="15" r="7" fill="${f.hair}"/><circle cx="40" cy="15" r="7" fill="${f.hair}"/>`,
    buns: `<circle cx="14" cy="18" r="8" fill="${f.hair}"/><circle cx="50" cy="18" r="8" fill="${f.hair}"/><path d="M16 30 q16 -20 32 0 q-16 -8 -32 0z" fill="${f.hair}"/>`,
    short: `<path d="M16 28 q4 -18 16 -18 q12 0 16 18 q-16 -6 -32 0z" fill="${f.hair}"/>`,
    ponytail: `<path d="M16 28 q4 -18 16 -18 q12 0 16 18 q-16 -6 -32 0z" fill="${f.hair}"/><path d="M48 24 q10 6 6 22" stroke="${f.hair}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
  }[f.style];
  return wrap(`<path d="M8 64 q0 -18 24 -18 q24 0 24 18z" fill="${f.top}"/><circle cx="32" cy="30" r="18" fill="${f.skin}"/>${hair}
    <circle cx="26" cy="31" r="2.2" fill="${P.ink}"/><circle cx="38" cy="31" r="2.2" fill="${P.ink}"/><path d="M27 38 q5 4 10 0" stroke="${P.ink}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <circle cx="22" cy="36" r="2.5" fill="${P.pink}" opacity="0.5"/><circle cx="42" cy="36" r="2.5" fill="${P.pink}" opacity="0.5"/>`);
}

/* ---------- Icons ---------- */
export const icons = {
  speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h3l5 4V6L7 10H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.8 4.6 1.2 6.5L12 17.2l-5.9 3.2 1.2-6.5L2.5 9.3l6.6-.8z" fill="#FFD23F" stroke="#E2B41A" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  starGrey: `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.8 4.6 1.2 6.5L12 17.2l-5.9 3.2 1.2-6.5L2.5 9.3l6.6-.8z" fill="#ECD9B8" stroke="#D9C39B" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5z"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM9 18V5l11-2v12"/><path d="M20 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 5.5v-1a1.5 1.5 0 0 1 3 0V11M14 6a1.5 1.5 0 0 1 3 0v5M17 8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4.2 14a1.6 1.6 0 0 1 2.6-1.8L8 13.5"/></svg>`,
};

/* ---------- Module illustrations (island art) ---------- */
const plateMini = (x, y, n, item) => {
  const dots = Array.from({ length: n }, (_, i) => `<circle cx="${x - 14 + (i % 3) * 14}" cy="${y - 4 + Math.floor(i / 3) * 12}" r="6" fill="${item}"/>`).join('');
  return `<ellipse cx="${x}" cy="${y}" rx="34" ry="18" fill="#fff" stroke="#EDEAF2" stroke-width="5"/>${dots}`;
};
export const moduleArt = {
  sharing: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
    ${plateMini(60, 70, 5, '#C98A4B')}${plateMini(140, 70, 5, '#C98A4B')}
    <g transform="translate(78 92)"><circle cx="22" cy="22" r="20" fill="#E3A866" stroke="#C98A4B" stroke-width="4"/><circle cx="16" cy="18" r="3" fill="#5B3A22"/><circle cx="28" cy="16" r="3" fill="#5B3A22"/><circle cx="26" cy="28" r="3" fill="#5B3A22"/></g>
    <path d="M100 30 q0 -14 0 -14" stroke="${P.orange}" stroke-width="6" stroke-linecap="round"/><path d="M90 24 l10 -10 l10 10" stroke="${P.orange}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,
  groups: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
    <g><circle cx="50" cy="60" r="36" fill="#fff" stroke="${P.blue}" stroke-width="6"/><g transform="translate(26 40) scale(0.5)">${items.sock(P.blue)}</g><g transform="translate(52 44) scale(0.5)">${items.sock(P.blue)}</g></g>
    <g><circle cx="150" cy="60" r="36" fill="#fff" stroke="${P.blue}" stroke-width="6"/><g transform="translate(126 40) scale(0.5)">${items.sock(P.pink)}</g><g transform="translate(152 44) scale(0.5)">${items.sock(P.pink)}</g></g>
    <text x="50" y="128" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="${P.blueDeep}">2</text>
    <text x="150" y="128" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="${P.blueDeep}">4</text>
  </svg>`,
  numbers: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${18 + i * 34}" y="20" width="30" height="30" rx="8" fill="${i === 2 ? P.green : '#fff'}" stroke="${i === 2 ? P.greenDeep : P.sandDeep}" stroke-width="3"/><text x="${33 + i * 34}" y="41" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="18" fill="${i === 2 ? '#fff' : P.ink}">${11 + i}</text>`).join('')}
    <rect x="30" y="68" width="16" height="56" rx="5" fill="${P.blue}"/><rect x="52" y="68" width="16" height="56" rx="5" fill="${P.blue}"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${86 + (i % 2) * 22}" y="${100 + Math.floor(i / 2) * 22}" width="16" height="16" rx="4" fill="${P.orange}"/>`).join('')}
    <text x="166" y="118" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="40" fill="${P.ink}">24</text>
  </svg>`,
  addsub: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="28" width="160" height="70" rx="14" fill="#fff" stroke="${P.sandDeep}" stroke-width="4"/>
    ${[...Array(10)].map((_, i) => `<rect x="${28 + (i % 5) * 30}" y="${36 + Math.floor(i / 5) * 30}" width="24" height="24" rx="6" fill="${P.sand}"/>`).join('')}
    ${[...Array(7)].map((_, i) => `<circle cx="${40 + (i % 5) * 30}" cy="${48 + Math.floor(i / 5) * 30}" r="9" fill="${i < 4 ? P.orange : P.blue}"/>`).join('')}
    <text x="100" y="128" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="24" fill="${P.ink}">4 + 3 = 7</text>
  </svg>`,
};

/* ---------- Stickers: Australian animals (viewBox 0 0 100 100) ---------- */
const S = (inner) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#fff"/><circle cx="50" cy="50" r="44" fill="${P.sand}"/>${inner}</svg>`;
const face = (x, y, dx = 9) => `<circle cx="${x - dx}" cy="${y}" r="3" fill="${P.ink}"/><circle cx="${x + dx}" cy="${y}" r="3" fill="${P.ink}"/>`;
export const STICKERS = [
  { id: 'koala', name: 'Koala', svg: S(`<circle cx="26" cy="36" r="13" fill="#9A9AA8"/><circle cx="74" cy="36" r="13" fill="#9A9AA8"/><circle cx="26" cy="36" r="7" fill="#F0B9C4"/><circle cx="74" cy="36" r="7" fill="#F0B9C4"/><circle cx="50" cy="50" r="28" fill="#B5B5C2"/>${face(50, 44, 11)}<ellipse cx="50" cy="56" rx="9" ry="7" fill="${P.ink}"/>`) },
  { id: 'kookaburra', name: 'Kookaburra', svg: S(`<ellipse cx="50" cy="60" rx="24" ry="26" fill="#C9B79C"/><circle cx="50" cy="38" r="20" fill="#fff"/><path d="M36 30 q14 -16 28 0z" fill="#6B4B2E"/><path d="M62 40 l22 4 l-22 6z" fill="#4A3B2A"/><circle cx="44" cy="40" r="3.5" fill="${P.ink}"/><path d="M34 42 q6 -5 12 -1" stroke="#6B4B2E" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M44 74 q8 -8 16 0" stroke="${P.blue}" stroke-width="6" stroke-linecap="round" fill="none"/>`) },
  { id: 'wombat', name: 'Wombat', svg: S(`<ellipse cx="50" cy="58" rx="32" ry="26" fill="#8B6B4E"/><circle cx="50" cy="42" r="22" fill="#A07F60"/><circle cx="34" cy="28" r="7" fill="#A07F60"/><circle cx="66" cy="28" r="7" fill="#A07F60"/>${face(50, 42, 10)}<ellipse cx="50" cy="52" rx="8" ry="6" fill="${P.ink}"/><ellipse cx="34" cy="80" rx="8" ry="5" fill="#5E4530"/><ellipse cx="66" cy="80" rx="8" ry="5" fill="#5E4530"/>`) },
  { id: 'platypus', name: 'Platypus', svg: S(`<ellipse cx="54" cy="56" rx="28" ry="20" fill="#7B5A3C"/><ellipse cx="30" cy="54" rx="18" ry="8" fill="#E39A3B"/><circle cx="44" cy="48" r="3" fill="${P.ink}"/><ellipse cx="74" cy="70" rx="14" ry="7" fill="#5A3E26"/><ellipse cx="40" cy="74" rx="9" ry="4" fill="#E39A3B"/><ellipse cx="62" cy="76" rx="9" ry="4" fill="#E39A3B"/>`) },
  { id: 'echidna', name: 'Echidna', svg: S(`<g stroke="#5B4634" stroke-width="5" stroke-linecap="round"><path d="M40 40 l-8 -14"/><path d="M50 36 l0 -16"/><path d="M60 38 l8 -14"/><path d="M68 46 l14 -8"/><path d="M34 50 l-16 -6"/></g><ellipse cx="52" cy="58" rx="28" ry="20" fill="#8E6E4F"/><path d="M26 60 q-14 2 -16 10 q10 2 16 -2z" fill="#6E5238"/><circle cx="36" cy="54" r="3" fill="${P.ink}"/>`) },
  { id: 'cockatoo', name: 'Cockatoo', svg: S(`<ellipse cx="50" cy="62" rx="22" ry="26" fill="#fff"/><circle cx="50" cy="40" r="18" fill="#fff"/><path d="M48 24 q-2 -14 8 -16 q-4 8 0 14 q6 -10 14 -8 q-8 8 -6 12z" fill="${P.yellow}"/><circle cx="44" cy="40" r="3.5" fill="${P.ink}"/><path d="M34 44 q0 10 10 8 q-2 -8 -10 -8z" fill="#5B5B6B"/>`) },
  { id: 'bilby', name: 'Bilby', svg: S(`<ellipse cx="34" cy="26" rx="8" ry="18" fill="#B9B4C9"/><ellipse cx="66" cy="26" rx="8" ry="18" fill="#B9B4C9"/><ellipse cx="34" cy="26" rx="4" ry="12" fill="#F0B9C4"/><ellipse cx="66" cy="26" rx="4" ry="12" fill="#F0B9C4"/><circle cx="50" cy="50" r="20" fill="#A8A3B8"/><ellipse cx="50" cy="74" rx="22" ry="14" fill="#A8A3B8"/>${face(50, 48, 8)}<path d="M44 58 q6 8 12 0" fill="${P.ink}"/>`) },
  { id: 'kangaroo', name: 'Kangaroo', svg: S(`<path d="M22 80 q8 -18 26 -14" stroke="#C7814E" stroke-width="10" stroke-linecap="round" fill="none"/><ellipse cx="54" cy="62" rx="20" ry="22" fill="#D99561"/><circle cx="60" cy="38" r="14" fill="#D99561"/><ellipse cx="52" cy="22" rx="4" ry="10" fill="#D99561"/><ellipse cx="66" cy="22" rx="4" ry="10" fill="#D99561"/><circle cx="66" cy="38" r="3" fill="${P.ink}"/><ellipse cx="74" cy="42" rx="4" ry="3" fill="${P.ink}"/><ellipse cx="52" cy="66" rx="10" ry="12" fill="#F2D2B2"/><ellipse cx="66" cy="84" rx="12" ry="5" fill="#C7814E"/>`) },
  { id: 'frog', name: 'Tree frog', svg: S(`<ellipse cx="50" cy="62" rx="28" ry="20" fill="${P.green}"/><circle cx="34" cy="40" r="10" fill="${P.green}"/><circle cx="66" cy="40" r="10" fill="${P.green}"/><circle cx="34" cy="40" r="5" fill="#fff"/><circle cx="66" cy="40" r="5" fill="#fff"/><circle cx="35" cy="41" r="2.5" fill="${P.ink}"/><circle cx="67" cy="41" r="2.5" fill="${P.ink}"/><path d="M38 60 q12 10 24 0" stroke="${P.greenDeep}" stroke-width="3.5" stroke-linecap="round" fill="none"/><ellipse cx="28" cy="80" rx="9" ry="4" fill="${P.orange}"/><ellipse cx="72" cy="80" rx="9" ry="4" fill="${P.orange}"/>`) },
  { id: 'quokka', name: 'Quokka', svg: S(`<ellipse cx="50" cy="66" rx="26" ry="20" fill="#9C7A55"/><circle cx="50" cy="42" r="22" fill="#B08A61"/><circle cx="32" cy="26" r="8" fill="#B08A61"/><circle cx="68" cy="26" r="8" fill="#B08A61"/>${face(50, 40, 10)}<ellipse cx="50" cy="48" rx="5" ry="4" fill="${P.ink}"/><path d="M38 54 q12 12 24 0" stroke="${P.ink}" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="34" cy="50" r="4" fill="${P.pink}" opacity="0.5"/><circle cx="66" cy="50" r="4" fill="${P.pink}" opacity="0.5"/>`) },
  { id: 'emu', name: 'Emu', svg: S(`<ellipse cx="46" cy="66" rx="26" ry="20" fill="#6E6A7A"/><path d="M62 60 q6 -24 2 -34" stroke="#6E6A7A" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="64" cy="24" r="10" fill="#8A8597"/><circle cx="68" cy="22" r="3" fill="${P.ink}"/><path d="M72 26 l12 2 l-12 4z" fill="#4A4455"/><path d="M36 84 v8 M52 84 v8" stroke="#4A4455" stroke-width="4" stroke-linecap="round"/>`) },
  { id: 'turtle', name: 'Sea turtle', svg: S(`<ellipse cx="50" cy="56" rx="28" ry="20" fill="${P.greenDeep}"/><ellipse cx="50" cy="54" rx="20" ry="13" fill="${P.green}"/><circle cx="80" cy="54" r="9" fill="#7FCBA4"/><circle cx="83" cy="52" r="2.5" fill="${P.ink}"/><ellipse cx="28" cy="40" rx="9" ry="5" fill="#7FCBA4" transform="rotate(-30 28 40)"/><ellipse cx="28" cy="72" rx="9" ry="5" fill="#7FCBA4" transform="rotate(30 28 72)"/><ellipse cx="70" cy="72" rx="9" ry="5" fill="#7FCBA4" transform="rotate(-30 70 72)"/>`) },
];

/* ---------- Backdrop: rolling hills + gum trees ---------- */
export const backdrop = `<svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="1040" cy="60" r="46" fill="#FFE08A" opacity="0.8"/>
  <path d="M0 220 Q 300 150 600 210 T 1200 190 V300 H0z" fill="#DDEFD9"/>
  <path d="M0 250 Q 250 200 500 245 T 1200 240 V300 H0z" fill="#C6E3C2"/>
  <g>
    <rect x="150" y="150" width="12" height="90" rx="6" fill="#B9A58A"/><ellipse cx="156" cy="140" rx="46" ry="34" fill="#A9D1B6"/><ellipse cx="130" cy="150" rx="26" ry="20" fill="#9BC7A8"/>
    <rect x="980" y="170" width="10" height="70" rx="5" fill="#B9A58A"/><ellipse cx="985" cy="160" rx="36" ry="28" fill="#A9D1B6"/>
    <rect x="720" y="195" width="8" height="50" rx="4" fill="#B9A58A"/><ellipse cx="724" cy="190" rx="26" ry="20" fill="#9BC7A8"/>
  </g>
</svg>`;

export const palette = P;
