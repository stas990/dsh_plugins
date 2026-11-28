/**
 * Host half of the diagram bundle: one model-facing tool that renders a
 * declarative diagram spec to SVG (and PNG through an optional rasterizer).
 * The visual style lives in lib/render.js; the model only supplies meaning.
 */
import { createDiagramTool } from './lib/tool.js'

export const name = 'diagram-render'
export const inject = ['tools']

/** Register the diagram tool for the life of this plugin entry. */
export function apply(ctx) {
  ctx.effect(() => ctx.tools.register(createDiagramTool(ctx)))
}
