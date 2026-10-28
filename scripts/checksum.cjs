// release/ içindeki kurulum dosyaları için SHA-256 özetleri üretir (SHA256SUMS.txt).
const { createHash } = require('crypto')
const { readdirSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')
const dir = join(__dirname, '..', 'release')
const lines = []
for (const f of readdirSync(dir)) {
  if (!/\.(exe|msi|zip|blockmap)$/i.test(f)) continue
  const h = createHash('sha256').update(readFileSync(join(dir, f))).digest('hex')
  lines.push(`${h}  ${f}`)
  console.log(h, f)
}
writeFileSync(join(dir, 'SHA256SUMS.txt'), lines.join('\n') + '\n')
