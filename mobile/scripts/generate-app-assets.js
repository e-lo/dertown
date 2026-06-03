#!/usr/bin/env node
// Regenerates all app icon and splash assets with the new white-on-palatinate-blue theme.
const sharp = require('sharp');
const path  = require('path');

const BLUE   = '#4740cb';
const WHITE  = '#ffffff';
const ASSETS = path.join(__dirname, '../assets');

// Mountain path helper — maps the original SVG viewBox (0 0 100 100) into a target canvas.
function mountainPaths(cx, cy, scale, strokeWidth) {
  const p = (x, y) => `${cx + (x - 50) * scale},${cy + (y - 50) * scale}`;
  return `
    <path d="M ${p(10,60)} L ${p(40,20)} L ${p(60,40)} L ${p(80,30)} L ${p(90,40)}"
          fill="none" stroke="${WHITE}" stroke-width="${strokeWidth}"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M ${p(10,60)} L ${p(40,20)} L ${p(60,60)}"
          fill="none" stroke="${WHITE}" stroke-width="${strokeWidth}"
          stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ── icon.png  1024×1024 ───────────────────────────────────────────────────
async function genIcon() {
  const W = 1024;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">
    <rect width="${W}" height="${W}" rx="220" fill="${BLUE}"/>
    ${mountainPaths(W/2, W/2, W * 0.0066, 28)}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png (1024×1024)');
}

// ── adaptive-icon.png  1024×1024 (Android — transparent bg) ──────────────
async function genAdaptiveIcon() {
  const W = 1024;
  // Android adaptive icon: foreground only, centred at 72% of canvas
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">
    <rect width="${W}" height="${W}" fill="${BLUE}"/>
    ${mountainPaths(W/2, W/2, W * 0.0052, 28)}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png (1024×1024)');
}

// ── splash.png  1284×2778 (iPhone 14 Pro Max canvas) ─────────────────────
async function genSplash() {
  const W = 1284, H = 2778;
  const scale = W * 0.004;  // mountain occupies ~40% of width
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${BLUE}"/>
    ${mountainPaths(W/2, H * 0.42, scale, 22)}
    <text x="${W/2}" y="${H * 0.58}"
          font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
          font-size="96" font-weight="800" fill="${WHITE}"
          text-anchor="middle" letter-spacing="-2">DerTown</text>
    <text x="${W/2}" y="${H * 0.622}"
          font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
          font-size="44" font-weight="400" fill="rgba(255,255,255,0.65)"
          text-anchor="middle" letter-spacing="4">LEAVENWORTH, WA</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS, 'splash.png'));
  console.log('✓ splash.png (1284×2778)');
}

// ── feature-graphic.png  1024×500 (Play Store) ───────────────────────────
async function genFeatureGraphic() {
  const W = 1024, H = 500;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="glow" cx="50%" cy="44%" r="35%">
        <stop offset="0%"   stop-color="${WHITE}" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="${BLUE}"  stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="60%"  stop-color="${BLUE}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${BLUE}" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="${BLUE}"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    ${mountainPaths(W/2, 190, 2.2, 4)}
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
    <text x="${W/2}" y="368"
          font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
          font-size="80" font-weight="800" letter-spacing="-2"
          fill="${WHITE}" text-anchor="middle">DerTown</text>
    <text x="${W/2}" y="418"
          font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
          font-size="24" font-weight="400" letter-spacing="4"
          fill="rgba(255,255,255,0.75)" text-anchor="middle">LEAVENWORTH, WA</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS, 'feature-graphic.png'));
  console.log('✓ feature-graphic.png (1024×500)');
}

Promise.all([genIcon(), genAdaptiveIcon(), genSplash(), genFeatureGraphic()])
  .then(() => console.log('\nAll assets regenerated.'))
  .catch(err => { console.error(err); process.exit(1); });
