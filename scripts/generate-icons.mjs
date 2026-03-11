// scripts/generate-icons.mjs
// Génère les icônes PNG pour la PWA en pure Node.js (pas de dépendances externes)
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

// CRC32 pour la validation des chunks PNG
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function createPNG(size) {
  // Couleurs de la marque — nouvelle palette
  const BG    = [0xfa, 0xf6, 0xf1]; // #FAF6F1 crème
  const FG    = [0xc6, 0x68, 0x4f]; // #C6684F terracotta principal
  const FG2   = [0xa8, 0x54, 0x3d]; // #A8543D terracotta foncé (anneau intérieur)
  const WHITE = [0xff, 0xff, 0xff];

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  // Pixel data: filter byte (0) + RGB per row
  const raw = Buffer.alloc(size * (1 + size * 3), 0);

  const cx = size / 2;
  const cy = size / 2;
  const r1 = size * 0.46; // bord extérieur cercle
  const r2 = size * 0.38; // bord extérieur anneau intérieur (blanc)
  const r3 = size * 0.30; // bord intérieur anneau (fond beige)

  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let color;
      if (dist > r1) {
        color = BG;      // fond beige extérieur
      } else if (dist > r2) {
        color = FG;      // cercle taupe
      } else if (dist > r3) {
        color = WHITE;   // anneau blanc
      } else {
        color = FG2;     // centre taupe foncé
      }

      const offset = y * (1 + size * 3) + 1 + x * 3;
      raw[offset]     = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

if (!existsSync('public')) mkdirSync('public');

for (const size of [180, 192, 512]) {
  const png = createPNG(size);
  writeFileSync(`public/icon-${size}.png`, png);
  console.log(`✓ public/icon-${size}.png (${Math.round(png.length / 1024)}KB)`);
}
