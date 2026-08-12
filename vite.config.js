import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function debugAgentLogPlugin() {
  const logFile = path.resolve(__dirname, 'debug-f391a9.log')
  return {
    name: 'debug-agent-log',
    configureServer(server) {
      server.middlewares.use('/__debug_agent_log', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', () => {
          try {
            const line = raw.trim() ? raw.trim() : '{}'
            fs.appendFileSync(logFile, line + '\n', 'utf8')
            res.statusCode = 204
            res.end()
          } catch (err) {
            res.statusCode = 500
            res.end(String(err))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), debugAgentLogPlugin()],
})
