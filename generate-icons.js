// Run with: node generate-icons.js
// Generates icon-192.png and icon-512.png — no npm install needed
const zlib = require('zlib')
const fs   = require('fs')

// ── CRC32 ─────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b }
function pngChunk(type, data) {
  const t = Buffer.from(type)
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))])
}

// ── DRAW ──────────────────────────────────────────────────────
function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 3)
  const cx = size / 2, cy = size / 2
  const BG  = [30, 26, 22]      // #1e1a16
  const AMB = [186, 117, 23]    // #BA7517
  const LIT = [210, 145, 55]    // lighter center

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / (size * 0.45)
      const dy = (y - cy) / (size * 0.45)
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)

      // 8-pointed star: alternating long/short rays
      const rays = 8
      const pulse = 0.55 + 0.35 * Math.pow(Math.abs(Math.sin(rays * angle / 2)), 1.4)
      const inStar = dist < pulse && dist > 0

      // Rounded background circle
      const inCircle = dist < 1.02

      let color = BG
      if (inCircle && inStar) color = dist < 0.18 ? LIT : AMB

      const i = (y * size + x) * 3
      pixels[i]   = color[0]
      pixels[i+1] = color[1]
      pixels[i+2] = color[2]
    }
  }
  return pixels
}

function makePNG(size) {
  const pixels = drawIcon(size)
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    row[0] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const pi = (y * size + x) * 3
      row[1 + x*3]   = pixels[pi]
      row[2 + x*3]   = pixels[pi+1]
      row[3 + x*3]   = pixels[pi+2]
    }
    rows.push(row)
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 })

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit depth, RGB

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),  // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

fs.writeFileSync('icon-192.png', makePNG(192))
fs.writeFileSync('icon-512.png', makePNG(512))
console.log('Done: icon-192.png and icon-512.png')
