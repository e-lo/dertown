#!/usr/bin/env node
// Generates logo variants + app screen mockups using actual theme palette colors
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const OUT = path.join(__dirname, '../assets/logo-variants');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

// ── Actual palette colors ──────────────────────────────────────────────────
const P = {
  navy:           '#0f172a',   // current app background
  cardDark:       '#1e293b',   // current card background
  canary:         '#ffe600',   // current accent
  palatinateBlue: '#4740cb',
  pigmentGreen:   '#4daa57',
  blueGreen:      '#219ebc',
  fandango:       '#c0268c',
  calPolyGreen:   '#14532d',
  darkSlateGray:  '#2f4445',
  brandeisBlue:   '#2472fc',
  white:          '#ffffff',
  offWhite:       '#f0f9ff',
};

// ── Logo helper ────────────────────────────────────────────────────────────
const L = 400;
const PAD = 60;
const VB = 100;
const SC = (L - PAD*2) / VB;
const OX = PAD, OY = PAD;
const pt = (x,y) => `${OX+x*SC},${OY+y*SC}`;

function logoSvg(bg, stroke, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L+40}">
  <rect width="${L}" height="${L}" rx="60" fill="${bg}"/>
  <path d="M ${pt(10,60)} L ${pt(40,20)} L ${pt(60,40)} L ${pt(80,30)} L ${pt(90,40)}"
        fill="none" stroke="${stroke}" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M ${pt(10,60)} L ${pt(40,20)} L ${pt(60,60)}"
        fill="none" stroke="${stroke}" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${L/2}" y="${L+28}" font-family="Helvetica,Arial,sans-serif"
        font-size="13" fill="#555" text-anchor="middle">${label}</text>
</svg>`;
}

const logoVariants = [
  { name: 'logo-A-current',      bg: P.navy,          stroke: P.canary,         label: 'A: Current (canary/navy)' },
  { name: 'logo-B-sky-on-blue',  bg: P.brandeisBlue,  stroke: P.white,          label: 'B: White / Brandeis Blue' },
  { name: 'logo-C-teal-on-navy', bg: P.navy,          stroke: P.blueGreen,      label: 'C: BlueGreen / Navy' },
  { name: 'logo-D-gold-on-teal', bg: P.darkSlateGray, stroke: P.canary,         label: 'D: Canary / Slate Gray' },
  { name: 'logo-E-white-on-teal',bg: P.blueGreen,     stroke: P.white,          label: 'E: White / BlueGreen' },
  { name: 'logo-F-forest',       bg: P.calPolyGreen,  stroke: P.offWhite,       label: 'F: OffWhite / Forest Green' },
  { name: 'logo-G-green-on-navy',bg: P.navy,          stroke: P.pigmentGreen,   label: 'G: PigmentGreen / Navy' },
  { name: 'logo-H-purple',       bg: P.palatinateBlue,stroke: P.canary,         label: 'H: Canary / Palatinate Blue' },
];

// ── App screen mockup helper ───────────────────────────────────────────────
// Simulates what the events feed looks like at different background colors
function appMockup(opts) {
  const {
    bg,          // screen background
    card,        // card/row background
    headerBg,    // header bar background
    accent,      // accent color (canary or alternative)
    textPrimary, // '#ffffff' or dark
    textMuted,   // muted text
    name,
    label,
  } = opts;

  const W = 390, H = 720;
  const HEADER_H = 56;
  const ROW_H = 80;
  const ROWS = [
    { tag: 'Arts+Culture', title: 'Bavarian Summer Market', time: '10:00 AM', loc: 'Front Street' },
    { tag: 'Nature',       title: 'Icicle Ridge Hike',       time: '8:00 AM',  loc: 'Trailhead' },
    { tag: 'Music',        title: 'Live Jazz at Brewery',    time: '6:00 PM',  loc: 'Icicle Brewing' },
    { tag: 'Family',       title: 'Splash Pad Opens',        time: 'All day',  loc: 'City Park' },
    { tag: 'Civic',        title: 'City Council Meeting',    time: '7:00 PM',  loc: 'City Hall' },
    { tag: 'Sports',       title: 'Mountain Bike Clinic',    time: '9:00 AM',  loc: 'Ski Hill' },
  ];

  const rows = ROWS.map((r, i) => {
    const y = HEADER_H + 36 + i * (ROW_H + 1);
    return `
    <!-- Row ${i}: ${r.title} -->
    <rect x="0" y="${y}" width="${W}" height="${ROW_H}" fill="${card}"/>
    <!-- Date column -->
    <text x="24" y="${y+22}" font-family="Helvetica,Arial" font-size="9" fill="${textMuted}" font-weight="600">JUN</text>
    <text x="24" y="${y+44}" font-family="Helvetica,Arial" font-size="22" fill="${textPrimary}" font-weight="800">${14+i}</text>
    <!-- Content -->
    <text x="72" y="${y+24}" font-family="Helvetica,Arial" font-size="13" fill="${textPrimary}" font-weight="700">${r.title}</text>
    <text x="72" y="${y+42}" font-family="Helvetica,Arial" font-size="10" fill="${textMuted}">${r.time} · ${r.loc}</text>
    <!-- Tag pill -->
    <rect x="72" y="${y+52}" width="${r.tag.length * 6 + 12}" height="16" rx="8" fill="${accent}" opacity="0.15"/>
    <text x="78" y="${y+63}" font-family="Helvetica,Arial" font-size="9" fill="${accent}" font-weight="700">${r.tag}</text>
    <!-- Star -->
    <text x="${W-32}" y="${y+46}" font-family="Helvetica,Arial" font-size="18" fill="${textMuted}" opacity="0.5">☆</text>
    <!-- Divider -->
    <line x1="0" y1="${y+ROW_H}" x2="${W}" y2="${y+ROW_H}" stroke="${textMuted}" stroke-opacity="0.1"/>`;
  }).join('');

  // Day header
  const dayHeader = `
    <rect x="0" y="${HEADER_H}" width="${W}" height="36" fill="${bg}"/>
    <text x="16" y="${HEADER_H+23}" font-family="Helvetica,Arial" font-size="12" fill="${accent}" font-weight="700" letter-spacing="1">TODAY · JUN 14</text>`;

  // Tab bar
  const tabs = ['Events','Map','Starred','News'];
  const tabW = W / tabs.length;
  const tabY = H - 60;
  const tabBar = `
    <rect x="0" y="${tabY}" width="${W}" height="60" fill="${headerBg}"/>
    <line x1="0" y1="${tabY}" x2="${W}" y2="${tabY}" stroke="${textMuted}" stroke-opacity="0.15"/>
    ${tabs.map((t, i) => `
    <text x="${tabW*i + tabW/2}" y="${tabY+22}" font-family="Helvetica,Arial" font-size="18"
          fill="${i===0 ? accent : textMuted}" text-anchor="middle" opacity="${i===0 ? 1 : 0.5}">
      ${['⊟','⊕','★','◉'][i]}
    </text>
    <text x="${tabW*i + tabW/2}" y="${tabY+40}" font-family="Helvetica,Arial" font-size="10"
          fill="${i===0 ? accent : textMuted}" text-anchor="middle" font-weight="${i===0 ? '700' : '400'}">${t}</text>`
    ).join('')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H+60}">
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${bg}"/>

  <!-- Header bar -->
  <rect width="${W}" height="${HEADER_H}" fill="${headerBg}"/>
  <!-- Mountain logo -->
  <text x="18" y="36" font-family="Helvetica,Arial" font-size="22" fill="${accent}">⛰</text>
  <text x="46" y="36" font-family="Helvetica,Arial" font-size="18" fill="${textPrimary}" font-weight="700">DerTown</text>
  <!-- Header icons -->
  <text x="${W-50}" y="36" font-family="Helvetica,Arial" font-size="16" fill="${textMuted}">📅</text>
  <text x="${W-24}" y="36" font-family="Helvetica,Arial" font-size="16" fill="${textMuted}">🔍</text>
  <line x1="0" y1="${HEADER_H}" x2="${W}" y2="${HEADER_H}" stroke="${textMuted}" stroke-opacity="0.15"/>

  ${dayHeader}
  ${rows}
  ${tabBar}

  <!-- Label -->
  <rect x="0" y="${H}" width="${W}" height="60" fill="#f5f5f5"/>
  <text x="${W/2}" y="${H+22}" font-family="Helvetica,Arial" font-size="13" fill="#333" text-anchor="middle" font-weight="700">${label}</text>
  <text x="${W/2}" y="${H+42}" font-family="Helvetica,Arial" font-size="11" fill="#777" text-anchor="middle">bg: ${bg}  accent: ${accent}</text>
</svg>`;
}

const appVariants = [
  {
    name: 'app-A-current',
    label: 'A: Current (navy + canary)',
    bg: P.navy, card: P.cardDark, headerBg: P.cardDark,
    accent: P.canary, textPrimary: P.white, textMuted: 'rgba(255,255,255,0.5)',
  },
  {
    name: 'app-B-slate-teal',
    label: 'B: Slate teal bg + canary',
    bg: '#0d2233', card: '#0f2d44', headerBg: '#0a1e2e',
    accent: P.canary, textPrimary: P.white, textMuted: 'rgba(255,255,255,0.5)',
  },
  {
    name: 'app-C-slate-sky-accent',
    label: 'C: Navy + blueGreen accent',
    bg: P.navy, card: P.cardDark, headerBg: P.cardDark,
    accent: P.blueGreen, textPrimary: P.white, textMuted: 'rgba(255,255,255,0.5)',
  },
  {
    name: 'app-D-forest-dark',
    label: 'D: Forest dark + canary',
    bg: '#0d1f16', card: '#142b1e', headerBg: '#0a1910',
    accent: P.canary, textPrimary: P.white, textMuted: 'rgba(255,255,255,0.5)',
  },
  {
    name: 'app-E-forest-green-accent',
    label: 'E: Navy + pigmentGreen accent',
    bg: P.navy, card: P.cardDark, headerBg: P.cardDark,
    accent: P.pigmentGreen, textPrimary: P.white, textMuted: 'rgba(255,255,255,0.5)',
  },
];

async function run() {
  console.log('Generating logo variants...');
  for (const v of logoVariants) {
    const svg = logoSvg(v.bg, v.stroke, v.label);
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${v.name}.png`));
    console.log(`  ✓ ${v.label}`);
  }

  console.log('\nGenerating app mockups...');
  for (const v of appVariants) {
    const svg = appMockup(v);
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${v.name}.png`));
    console.log(`  ✓ ${v.label}`);
  }

  console.log(`\nAll images → ${OUT}`);
}

run().catch(err => { console.error(err); process.exit(1); });
