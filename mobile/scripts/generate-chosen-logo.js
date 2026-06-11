#!/usr/bin/env node
const sharp = require('sharp');
const path = require('path');

const SIZE = 400;
const PAD = 70;
const SC = (SIZE - PAD*2) / 100;
const OX = PAD, OY = PAD;
const pt = (x,y) => `${OX+x*SC},${OY+y*SC}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="88" fill="#4740cb"/>
  <path d="M ${pt(10,60)} L ${pt(40,20)} L ${pt(60,40)} L ${pt(80,30)} L ${pt(90,40)}"
        fill="none" stroke="#ffffff" stroke-width="8"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M ${pt(10,60)} L ${pt(40,20)} L ${pt(60,60)}"
        fill="none" stroke="#ffffff" stroke-width="8"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

sharp(Buffer.from(svg)).png()
  .toFile(path.join(__dirname, '../assets/logo-variants/chosen-logo-preview.png'))
  .then(() => console.log('✓ saved'));
