const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function createSvg(size) {
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0B1220"/>
  <text x="${size/2}" y="${size * 0.65}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${size * 0.6}" fill="#e8417a">V</text>
  <line x1="${size * 0.3}" y1="${size * 0.78}" x2="${size * 0.7}" y2="${size * 0.78}" stroke="#e8417a" stroke-width="${Math.max(2, size * 0.02)}" stroke-linecap="round" opacity="0.5"/>
</svg>`);
}

async function main() {
  console.log('Generando iconos PWA...');
  for (const size of sizes) {
    const svg = createSvg(size);
    const outputPath = path.join(outputDir, 'icon-' + size + 'x' + size + '.png');
    await sharp(svg).resize(size, size).png().toFile(outputPath);
    console.log('  OK: icon-' + size + 'x' + size + '.png');
  }
  console.log('Listo! ' + sizes.length + ' iconos generados.');
}

main().catch(function(err) { console.error('Error:', err); });
