#!/usr/bin/env node
// Generates logo color variants for review — 400×400px each
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../assets/logo-variants');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const variants = [
  {
    name: '1-current',
    label: 'Current (canary on navy)',
    bg: '#0f172a',
    stroke: '#ffe600',
  },
  {
    name: '2-sky-on-navy',
    label: 'Alpine sky blue on navy',
    bg: '#0f172a',
    stroke: '#38bdf8',
  },
  {
    name: '3-white-on-sky',
    label: 'White peaks on alpine sky',
    bg: '#1d6fa4',
    stroke: '#ffffff',
  },
  {
    name: '4-snow-on-slate',
    label: 'Snow white on slate blue',
    bg: '#1e3a5f',
    stroke: '#f0f9ff',
  },
  {
    name: '5-gold-on-sky',
    label: 'Sunrise gold on deep sky',
    bg: '#0c4a6e',
    stroke: '#fbbf24',
  },
  {
    name: '6-navy-on-white',
    label: 'Navy peaks on white (light mode)',
    bg: '#ffffff',
    stroke: '#0f172a',
  },
  {
    name: '7-forest-on-cream',
    label: 'Forest green on warm cream',
    bg: '#fef3c7',
    stroke: '#166534',
  },
  {
    name: '8-alpine-on-meadow',
    label: 'White on alpine meadow green',
    bg: '#14532d',
    stroke: '#f0fdf4',
  },
];

const SIZE = 400;
const PAD = 60; // padding around the mountain
const VB = 100; // original viewBox size
const SCALE = (SIZE - PAD * 2) / VB;
const OX = PAD;
const OY = PAD;

function pt(x, y) {
  return `${OX + x * SCALE},${OY + y * SCALE}`;
}

function makeSvg(bg, stroke) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="60" fill="${bg}"/>
  <path d="M ${pt(10,60)} L ${pt(40,20)} L ${pt(60,40)} L ${pt(80,30)} L ${pt(90,40)}"
        fill="none" stroke="${stroke}" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M ${pt(10,60)} L ${pt(40,20)} L ${pt(60,60)}"
        fill="none" stroke="${stroke}" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

async function run() {
  for (const v of variants) {
    const svg = makeSvg(v.bg, v.stroke);
    const outPath = path.join(OUT_DIR, `${v.name}.png`);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    console.log(`✓ ${v.label} → ${v.name}.png`);
  }
  console.log(`\nAll variants saved to ${OUT_DIR}`);
}

run().catch(err => { console.error(err); process.exit(1); });
