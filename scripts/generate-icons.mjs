/**
 * Generate PWA icons from an SVG source.
 * Usage: node scripts/generate-icons.mjs
 *
 * Requires: sharp (will be installed temporarily if needed)
 * Generates all required icon sizes into public/icons/
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { readFile } from 'fs/promises'

// Check if sharp is available, install temporarily if not
try {
  await import('sharp')
} catch {
  console.log('Installing sharp temporarily...')
  execSync('pnpm add -D sharp', { stdio: 'inherit' })
}

const sharp = (await import('sharp')).default

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const maskableSizes = [192, 512]

const svgIcon = await readFile(new URL('../public/icons/autopro-icon.svg', import.meta.url), 'utf8')
const maskableSvg = await readFile(new URL('../public/icons/autopro-icon.svg', import.meta.url), 'utf8')

const outDir = fileURLToPath(new URL('../public/icons/', import.meta.url))
const faviconPath = fileURLToPath(new URL('../public/favicon.ico', import.meta.url))

for (const size of sizes) {
  const filename = `icon-${size}x${size}.png`
  await sharp(Buffer.from(svgIcon))
    .resize(size, size)
    .png()
    .toFile(`${outDir}${filename}`)
  console.log(`✓ ${filename}`)
}

for (const size of maskableSizes) {
  const filename = `icon-maskable-${size}x${size}.png`
  await sharp(Buffer.from(maskableSvg))
    .resize(size, size)
    .png()
    .toFile(`${outDir}${filename}`)
  console.log(`✓ ${filename}`)
}

// Generate apple-touch-icon (180x180)
await sharp(Buffer.from(svgIcon))
  .resize(180, 180)
  .png()
  .toFile(`${outDir}apple-touch-icon.png`)
console.log('✓ apple-touch-icon.png')

try {
  execSync(`convert ${outDir}autopro-icon.svg -background none -define icon:auto-resize=16,32,48 ${faviconPath}`, { stdio: 'ignore' })
  console.log('✓ favicon.ico')
} catch {
  console.log('! favicon.ico was not regenerated because ImageMagick `convert` is unavailable')
}

console.log('\nAll icons generated successfully!')
