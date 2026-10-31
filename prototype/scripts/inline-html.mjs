import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const distDir = path.join(projectDir, 'dist')
const htmlPath = path.join(distDir, 'index.html')
let html = await readFile(htmlPath, 'utf8')

const mimeTypes = {
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function assetData(assetUrl) {
  const relativePath = assetUrl.replace(/^\.\//, '').replace(/^\//, '')
  const assetPath = path.join(distDir, relativePath)
  const bytes = await readFile(assetPath)
  const mimeType = mimeTypes[path.extname(assetPath)] ?? 'application/octet-stream'
  return `data:${mimeType};base64,${bytes.toString('base64')}`
}

const scriptTag = html.match(/<script([^>]*)\ssrc="([^"]+\.js)"([^>]*)><\/script>/)
if (!scriptTag) throw new Error('Vite entry script was not found in dist/index.html')
let scriptSource = await readFile(path.join(distDir, scriptTag[2].replace(/^\.\//, '')), 'utf8')

const cssTag = html.match(/<link([^>]*?)\shref="([^"]+\.css)"([^>]*)\s*\/?\s*>/)
if (!cssTag) throw new Error('Vite stylesheet was not found in dist/index.html')
let css = await readFile(path.join(distDir, cssTag[2].replace(/^\.\//, '')), 'utf8')
const assetFiles = await readdir(path.join(distDir, 'assets'))
for (const filename of assetFiles.filter((file) => !/\.(?:js|css)$/.test(file))) {
  const dataUrl = await assetData(`assets/${filename}`)
  for (const reference of [filename, `./assets/${filename}`, `/assets/${filename}`, `assets/${filename}`]) {
    scriptSource = scriptSource.replaceAll(reference, dataUrl)
    css = css.replaceAll(reference, dataUrl)
  }
}
html = html.replace(scriptTag[0], `<script type="module">${scriptSource}</script>`)
html = html.replace(cssTag[0], `<style>${css}</style>`)

const iconTag = html.match(/<link([^>]*\srel="icon"[^>]*)\shref="([^"]+)"([^>]*)\s*\/?\s*>/)
if (iconTag && !iconTag[2].startsWith('data:')) {
  html = html.replace(iconTag[0], iconTag[0].replace(iconTag[2], await assetData(iconTag[2])))
}

await writeFile(path.join(projectDir, 'bundle.html'), html)
console.log(`Created ${path.join(projectDir, 'bundle.html')}`)
