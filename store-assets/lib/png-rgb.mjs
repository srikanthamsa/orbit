/**
 * Rewrites an 8-bit RGBA PNG as an 8-bit RGB PNG.
 *
 * The Chrome Web Store rejects screenshots that carry an alpha channel, and
 * Playwright always writes RGBA. Compositing onto white would also work, but
 * every slide here is drawn on an opaque canvas already, so dropping the
 * channel is lossless and keeps the file smaller.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function pngToRgb(path) {
  const file = readFileSync(path);
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${path} is not a PNG`);

  let offset = 8;
  let header = null;
  const idat = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.subarray(offset + 4, offset + 8).toString('ascii');
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (!header) throw new Error('missing IHDR');

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const interlace = header[12];
  if (bitDepth !== 8 || interlace !== 0) throw new Error('expected 8-bit, non-interlaced PNG');
  if (colorType === 2) return { width, height, converted: false };
  if (colorType !== 6) throw new Error(`unsupported colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * (width * 3 + 1));
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? row[x - bpp] : 0;
      const up = previous[x];
      const upLeft = x >= bpp ? previous[x - bpp] : 0;
      const value = line[x];
      row[x] =
        filter === 0
          ? value
          : filter === 1
            ? (value + left) & 0xff
            : filter === 2
              ? (value + up) & 0xff
              : filter === 3
                ? (value + ((left + up) >> 1)) & 0xff
                : (value + paeth(left, up, upLeft)) & 0xff;
    }
    const target = y * (width * 3 + 1);
    out[target] = 0;
    for (let x = 0; x < width; x++) {
      out[target + 1 + x * 3] = row[x * bpp];
      out[target + 2 + x * 3] = row[x * bpp + 1];
      out[target + 3 + x * 3] = row[x * bpp + 2];
    }
    previous = row;
  }

  const nextHeader = Buffer.from(header);
  nextHeader[9] = 2;
  writeFileSync(
    path,
    Buffer.concat([
      SIGNATURE,
      chunk('IHDR', nextHeader),
      chunk('IDAT', deflateSync(out, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
  return { width, height, converted: true };
}
