// icons.mjs — rasterize the brand mark to PNG icons.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2dd4bf"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">
    <path d="M30 88 V42 L52 68 L74 42 V88"/>
    <path d="M97 44 V82"/>
    <path d="M85 70 L97 84 L109 70"/>
  </g>
</svg>`;

const sizes = [16, 32, 48, 128];

async function main() {
  await mkdir(path.join(root, 'icons'), { recursive: true }).catch(() => {});
  const buf = Buffer.from(svg);
  for (const s of sizes) {
    await sharp(buf, { density: 384 })
      .resize(s, s, { fit: 'contain' })
      .png()
      .toFile(path.join(root, 'icons', `icon${s}.png`));
  }
  console.log('✓ icons written:', sizes.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
