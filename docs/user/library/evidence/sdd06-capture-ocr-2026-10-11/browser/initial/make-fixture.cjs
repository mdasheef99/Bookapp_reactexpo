const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const width = 1200, height = 800;
const raw = Buffer.alloc(height * (1 + width * 4));
for (let y = 0; y < height; y += 1) {
  const row = y * (1 + width * 4); raw[row] = 0;
  for (let x = 0; x < width; x += 1) {
    const offset = row + 1 + x * 4;
    let c = [255, 253, 247, 255];
    if (x < 10 || y < 10 || x >= width - 10 || y >= height - 10) c = [175, 35, 35, 255];
    else if (x >= 90 && x < 125) c = [40, 80, 145, 255];
    else if (y >= 110 && y < 165) c = [223, 227, 220, 255];
    else if (x >= 180 && x < 1080 && y >= 210 && y < 690 && ((y - 210) % 80 < 5) && x < 1080 - Math.floor((y - 210) / 6)) c = [42, 47, 43, 255];
    else if (x >= 180 && x < 1080 && y >= 210 && y < 690 && ((y - 210) % 80 < 5) && x >= 1080 - Math.floor((y - 210) / 6)) c = [255, 253, 247, 255];
    raw[offset] = c[0]; raw[offset + 1] = c[1]; raw[offset + 2] = c[2]; raw[offset + 3] = c[3];
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});
function crc32(bytes) { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const kind = Buffer.from(type, 'ascii'); const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); kind.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([kind, data])), 8 + data.length); return out;
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const output = path.join(__dirname, 'synthetic-page-fixture.png'); fs.writeFileSync(output, png);
process.stdout.write(JSON.stringify({ path: output, width, height, bytes: png.length, sha256: require('node:crypto').createHash('sha256').update(png).digest('hex').toUpperCase(), syntheticOnly: true }) + '\n');
