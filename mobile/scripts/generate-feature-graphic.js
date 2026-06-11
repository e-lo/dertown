#!/usr/bin/env node
// Generates Play Store feature graphic: 1024×500px
const sharp = require('sharp');
const path = require('path');

const WIDTH = 1024;
const HEIGHT = 500;

// Mountain path scaled to ~160×160 within a 200×200 viewport, centred at (512, 220)
// Original viewBox 0 0 100 100 → scale 1.6 → translate to centre
const SCALE = 1.6;
const OX = 512 - (100 * SCALE) / 2;  // ≈ 432
const OY = 160 - (100 * SCALE) / 2;  // ≈ 80

function pt(x, y) {
  return `${OX + x * SCALE},${OY + y * SCALE}`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <!-- Subtle radial glow behind the mountain -->
    <radialGradient id="glow" cx="50%" cy="44%" r="35%">
      <stop offset="0%"  stop-color="#ffe600" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
    </radialGradient>
    <!-- Subtle horizontal fade at the bottom -->
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="60%"  stop-color="#0f172a" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="1"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0f172a"/>

  <!-- Glow halo -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

  <!-- Mountain outline (ridge line) -->
  <path d="M ${pt(10,60)} L ${pt(40,20)} L ${pt(60,40)} L ${pt(80,30)} L ${pt(90,40)}"
        fill="none" stroke="#ffe600" stroke-width="3.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>

  <!-- Main peak wedge -->
  <path d="M ${pt(10,60)} L ${pt(40,20)} L ${pt(60,60)}"
        fill="none" stroke="#ffe600" stroke-width="3.5"
        stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Bottom fade overlay -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fade)"/>

  <!-- App name -->
  <text x="${WIDTH / 2}" y="368"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="80" font-weight="700" letter-spacing="-2"
        fill="#ffffff" text-anchor="middle" dominant-baseline="auto">Dertown</text>

  <!-- Tagline -->
  <text x="${WIDTH / 2}" y="418"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="24" font-weight="400" letter-spacing="2"
        fill="#ffe600" text-anchor="middle" opacity="0.85"
        text-transform="uppercase">LEAVENWORTH, WA</text>
</svg>`;

const outPath = path.join(__dirname, '../assets/feature-graphic.png');

sharp(Buffer.from(svg))
  .png()
  .toFile(outPath)
  .then(() => console.log(`✓ feature-graphic.png written to ${outPath}`))
  .catch(err => { console.error(err); process.exit(1); });
