const userAgent = 'gs1-3d-catalog-poc (+https://gs1-3d-catalog-poc.vercel.app)'

export class UpstreamError extends Error {
  constructor(status) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

export async function fetchJson(url, signal = AbortSignal.timeout(6000)) {
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new UpstreamError(response.status)
  return response.json()
}

export function respond(res, status, data, cache = 'no-store') {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', cache)
  res.end(JSON.stringify(data))
}

export function getHandler(action) {
  return async (req, res) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return respond(res, 405, { error: 'method_not_allowed' })
    }
    try {
      await action(new URL(req.url, 'http://localhost').searchParams, res)
    } catch (error) {
      console.error(error)
      respond(res, 500, { error: 'service_unavailable' })
    }
  }
}
