import { defineConfig, type Connect, type Plugin } from 'vite'
import offers from './api/offers.js'
import gtin from './api/gtin.js'

function catalogApi(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    if (pathname === '/api/offers') void offers(req, res)
    else if (pathname === '/api/gtin') void gtin(req, res)
    else next()
  }
  return {
    name: 'catalog-api',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}

export default defineConfig({
  plugins: [catalogApi()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /\/three\/build\/three\.core\.js$/ },
          ],
        },
      },
    },
  },
})
