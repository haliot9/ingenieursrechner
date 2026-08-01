import { readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const INITIAL_JS_LIMIT_BYTES = 230 * 1024
const INITIAL_JS_GZIP_LIMIT_BYTES = 75 * 1024
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = resolve(projectRoot, 'dist')
const indexPath = resolve(distRoot, 'index.html')

const html = await readFile(indexPath, 'utf8')
const assetPaths = new Set()

for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/g)) {
  assetPaths.add(match[1])
}
for (const match of html.matchAll(/<link\b[^>]*\brel=["']modulepreload["'][^>]*\bhref=["']([^"']+\.js)["'][^>]*>/g)) {
  assetPaths.add(match[1])
}

if (assetPaths.size === 0) {
  throw new Error('Initial bundle budget could not find an entry script in dist/index.html')
}

const assets = []
for (const assetPath of assetPaths) {
  const normalizedPath = assetPath.replace(/^\.\//, '').replace(/^\//, '')
  const filePath = resolve(distRoot, normalizedPath)
  const [contents, metadata] = await Promise.all([readFile(filePath), stat(filePath)])
  assets.push({ path: normalizedPath, bytes: metadata.size, gzipBytes: gzipSync(contents).byteLength })
}

const totals = assets.reduce((sum, asset) => ({
  bytes: sum.bytes + asset.bytes,
  gzipBytes: sum.gzipBytes + asset.gzipBytes,
}), { bytes: 0, gzipBytes: 0 })

const toKiB = bytes => (bytes / 1024).toFixed(2)
console.log(`Initial JS: ${toKiB(totals.bytes)} KiB minified / ${toKiB(totals.gzipBytes)} KiB gzip`)
for (const asset of assets) {
  console.log(`  ${asset.path}: ${toKiB(asset.bytes)} KiB / ${toKiB(asset.gzipBytes)} KiB gzip`)
}

const failures = []
if (totals.bytes > INITIAL_JS_LIMIT_BYTES) {
  failures.push(`${toKiB(totals.bytes)} KiB exceeds ${toKiB(INITIAL_JS_LIMIT_BYTES)} KiB minified`)
}
if (totals.gzipBytes > INITIAL_JS_GZIP_LIMIT_BYTES) {
  failures.push(`${toKiB(totals.gzipBytes)} KiB exceeds ${toKiB(INITIAL_JS_GZIP_LIMIT_BYTES)} KiB gzip`)
}
if (failures.length > 0) {
  throw new Error(`Initial JS bundle budget exceeded: ${failures.join('; ')}`)
}
