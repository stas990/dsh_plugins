/**
 * PNG export is the only part of the bundle that needs a rasterizer. The
 * dependency is optional at runtime: when it cannot be resolved, the tool still
 * writes the SVG and reports why the PNG is missing instead of failing the
 * whole call.
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = path.resolve(here, '..')

let cachedModule

function loadResvg() {
  if (cachedModule !== undefined) return cachedModule
  const candidates = [pluginRoot]
  if (process.env.DSH_PROFILE_DIR) candidates.push(process.env.DSH_PROFILE_DIR)
  candidates.push(process.cwd())

  const failures = []
  for (const base of candidates) {
    try {
      const require = createRequire(path.join(base, 'package.json'))
      // Windows junctions keep their own path as the module filename, which
      // breaks the rasterizer's lookup of its per-platform native package.
      // Loading through the real path makes that lookup succeed.
      const entry = require.resolve('@resvg/resvg-js')
      cachedModule = require(fs.realpathSync.native(entry))
      return cachedModule
    } catch (error) {
      failures.push(`${base}: ${error.code ?? error.message}`)
    }
  }
  throw new Error(
    'PNG export needs the @resvg/resvg-js rasterizer and it could not be loaded. ' +
      'The SVG was still written; reinstall the bundle with its dependencies to enable PNG. ' +
      `(${failures.join('; ')})`,
  )
}

/**
 * Rasterize an SVG document at a device scale.
 * @param svg - complete SVG text.
 * @param scale - pixel multiplier (2 renders the same layout at double size).
 * @returns PNG bytes and the rendered pixel dimensions.
 */
export function svgToPng(svg, scale) {
  const { Resvg } = loadResvg()
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' },
  })
  const rendered = renderer.render()
  return { bytes: rendered.asPng(), width: rendered.width, height: rendered.height }
}
