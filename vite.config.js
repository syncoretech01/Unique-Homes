import { defineConfig } from 'vite'
import { resolve, dirname } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const INCLUDE_RE = /<!--\s*#include\s+"([^"]+)"\s*-->/g

/**
 * Zero-dependency HTML partial system.
 * Usage inside any page:  <!-- #include "src/sections/hero/hero.html" -->
 * Nested includes are resolved up to 12 levels deep.
 */
function htmlIncludes() {
  const read = (p) => {
    const file = resolve(root, p)
    if (!existsSync(file)) return `<!-- [include] missing: ${p} -->`
    return readFileSync(file, 'utf8')
  }
  return {
    name: 'uhd-html-includes',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let out = html
        for (let depth = 0; depth < 12; depth++) {
          if (!/<!--\s*#include/.test(out)) break
          out = out.replace(INCLUDE_RE, (_m, p) => read(p.trim()))
        }
        return out
      },
    },
    configureServer(server) {
      server.watcher.add(resolve(root, 'src'))
      server.watcher.on('change', (file) => {
        if (file.endsWith('.html') && !file.endsWith('index.html')) {
          server.ws.send({ type: 'full-reload', path: '*' })
        }
      })
    },
  }
}

export default defineConfig({
  root,
  base: '/',
  plugins: [htmlIncludes()],
  server: { host: true, port: 5180, strictPort: true, open: false },
  preview: { host: true, port: 4180, strictPort: true },
  build: {
    target: 'es2022',
    cssTarget: 'chrome110',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      input: {
        home: resolve(root, 'index.html'),
        services: resolve(root, 'services/index.html'),
        projects: resolve(root, 'projects/index.html'),
        studio: resolve(root, 'studio/index.html'),
        journal: resolve(root, 'journal/index.html'),
        contact: resolve(root, 'contact/index.html'),
        notfound: resolve(root, '404.html'),
      },
      output: {
        // Three and GSAP are shared by all seven entries — split them out so a
        // visitor downloads them once and hits cache on every other page.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/gsap')) return 'gsap'
          if (id.includes('node_modules/lenis')) return 'lenis'
          return null
        },
      },
    },
  },
})
