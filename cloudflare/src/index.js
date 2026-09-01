/**
 * exodus-ii.folia.app as a Worker.
 *
 * netlify.toml declares one rule: /v1/metadata/* -> the metadata function.
 * There is no catch-all, so unknown paths stay 404 rather than becoming a
 * 200 index.html.
 */
import metadataFn from '../../src/lambda/metadata.cjs'
import { runNetlifyFunction } from './netlify'

export default {
  async fetch (request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/v1/metadata/')) {
      // The handler reads the token id off the tail of event.path.
      return runNetlifyFunction(metadataFn.handler, request, { path: url.pathname })
    }

    let res = await asset(env, request, url.pathname)
    if (res.status === 404 && url.pathname.endsWith('/')) {
      const idx = await asset(env, request, url.pathname + 'index.html')
      if (idx.status !== 404) res = idx
    }
    if (res.status === 404 && !/\.[a-z0-9]+$/i.test(url.pathname)) {
      const withExt = await asset(env, request, url.pathname.replace(/\/$/, '') + '.html')
      if (withExt.status !== 404) res = withExt
    }
    return res
  }
}

function asset (env, request, pathname) {
  const u = new URL(request.url)
  u.pathname = pathname
  u.search = ''
  return env.ASSETS.fetch(new Request(u, { method: request.method, headers: request.headers }))
}
