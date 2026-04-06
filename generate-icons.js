// Run with: node generate-icons.js
const zlib = require('zlib')
const fs   = require('fs')

// ── PNG encoder ───────────────────────────────────────────────
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
function chunk(type, data) {
  const t = Buffer.from(type)
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))])
}
function makePNG(pixels, size) {
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    row[0] = 0
    for (let x = 0; x < size; x++) {
      const pi = (y * size + x) * 4
      row[1 + x*4] = pixels[pi]; row[2 + x*4] = pixels[pi+1]
      row[3 + x*4] = pixels[pi+2]; row[4 + x*4] = pixels[pi+3]
    }
    rows.push(row)
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6  // RGBA
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ── Rendering helpers ─────────────────────────────────────────
// Point-in-polygon for the star shape
function ptInPoly(px, py, verts) {
  let inside = false
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i][0], yi = verts[i][1]
    const xj = verts[j][0], yj = verts[j][1]
    if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// Distance from point to line segment
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / (dx*dx + dy*dy)))
  const nx = ax + t*dx - px, ny = ay + t*dy - py
  return Math.sqrt(nx*nx + ny*ny)
}

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4)
  const S = size / 52  // scale factor from 52x52 viewBox

  // Background color #1e1a16
  const BG = [30, 26, 22]
  // Amber #BA7517
  const AMB = [186, 117, 23]

  // Outer star vertices (scaled): M26 6 L30 22 L46 26 L30 30 L26 46 L22 30 L6 26 L22 22 Z
  const outerStar = [[26,6],[30,22],[46,26],[30,30],[26,46],[22,30],[6,26],[22,22]].map(([x,y])=>[x*S,y*S])
  // Inner star: M26 14 L28 22 L36 26 L28 30 L26 38 L24 30 L16 26 L24 22 Z
  const innerStar = [[26,14],[28,22],[36,26],[28,30],[26,38],[24,30],[16,26],[24,22]].map(([x,y])=>[x*S,y*S])
  // Center circle
  const cx = 26*S, cy = 26*S, cr = 3*S
  // Stroke width scaled
  const sw = 1.5 * S

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4

      // Rounded rect background — corner radius scaled from 12/52
      const r = 12 * S
      const inRRect = x >= r && x <= size-r && y >= 0 && y <= size ||
                      x >= 0 && x <= size && y >= r && y <= size-r ||
                      Math.hypot(x-r, y-r) <= r ||
                      Math.hypot(x-(size-r), y-r) <= r ||
                      Math.hypot(x-r, y-(size-r)) <= r ||
                      Math.hypot(x-(size-r), y-(size-r)) <= r

      if (!inRRect) { pixels[i+3] = 0; continue }

      // Start with background
      let [R, G, B, A] = [BG[0], BG[1], BG[2], 255]

      // Center circle (solid amber)
      const dc = Math.hypot(x - cx, y - cy)
      if (dc <= cr) {
        R = AMB[0]; G = AMB[1]; B = AMB[2]
      }
      // Inner star fill (amber 40% opacity over bg)
      else if (ptInPoly(x, y, innerStar)) {
        R = Math.round(BG[0] * 0.6 + AMB[0] * 0.4)
        G = Math.round(BG[1] * 0.6 + AMB[1] * 0.4)
        B = Math.round(BG[2] * 0.6 + AMB[2] * 0.4)
      }

      // Outer star stroke — draw each edge of the star polygon
      let onStroke = false
      for (let k = 0; k < outerStar.length; k++) {
        const [ax, ay] = outerStar[k]
        const [bx, by] = outerStar[(k+1) % outerStar.length]
        if (distToSeg(x, y, ax, ay, bx, by) <= sw) { onStroke = true; break }
      }
      if (onStroke) { R = AMB[0]; G = AMB[1]; B = AMB[2] }

      pixels[i] = R; pixels[i+1] = G; pixels[i+2] = B; pixels[i+3] = A
    }
  }
  return pixels
}

fs.writeFileSync('icon-192.png', makePNG(drawIcon(192), 192))
fs.writeFileSync('icon-512.png', makePNG(drawIcon(512), 512))
console.log('Done: icon-192.png icon-512.png')
