import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from 'vite'

function localPrivateWatchtowerPacks() {
  return {
    name: 'local-private-watchtower-packs',
    apply: 'serve' as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        const match = pathname.match(/\/__private-watchtower\/watchtower-(\d+)\.json$/)
        if (!match) {
          next()
          return
        }

        try {
          const pack = await readFile(resolve('.private', `${match[1]}.watchtower-private.json`), 'utf8')
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(pack)
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            response.statusCode = 404
            response.end()
            return
          }
          next(error instanceof Error ? error : new Error('Impossible de lire le pack Watchtower privé.'))
        }
      })
    },
  }
}

export default defineConfig({
  base: '/family-bible-study/',
  plugins: [react(), localPrivateWatchtowerPacks()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    maxWorkers: 1,
    setupFiles: './src/test/setup.ts',
  },
})
