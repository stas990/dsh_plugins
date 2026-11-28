/**
 * The model-facing tool: validate a declarative spec, render the fixed visual
 * system, and write SVG/PNG next to the session workspace. File effects are
 * checked against the session's sandbox policy before anything is written.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { buildDiagram } from './render.js'
import { normalizeSpec } from './spec.js'
import { listIconIds } from './icons.js'
import { svgToPng } from './png.js'

const TOOL_NAME = 'diagram_render'
const PNG_SCALE = 2
const MAX_SLUG = 60

function describe() {
  const icons = listIconIds()
    .filter((id) => id.startsWith('core/'))
    .map((id) => id.slice('core/'.length))
    .join(', ')
  return [
    "Render an architecture or flow diagram as SVG and PNG in the harness's fixed visual style.",
    'The renderer owns layout, colors, typography and icon placement, so the same spec always renders the same picture; do not put styling in the spec.',
    '',
    'Spec fields:',
    '- title: optional heading above the diagram.',
    '- direction: "LR" (default, left to right) or "TB" (top to bottom).',
    '- nodes: [{ id, label, kind?, icon?, accent?, note?, notes? }]. `id` is a short unique key used by edges; `kind` is an optional small caption under the label (for example "service"); `accent` is one of blue, teal, amber, rose, violet, slate; `note` is a short remark drawn inside the box and `notes` is up to six list items under it. Both may be given: the remark comes first, then the list, and the merged text is capped at 320 characters — the card grows to fit.',
    '- edges: [{ from, to, label?, dashed? }] connecting node ids.',
    '- groups: optional [{ label, nodes: [ids], accent? }] framed areas around related nodes.',
    '',
    `Bundled icons (use the bare name or "core/name"): ${icons}.`,
    'Common concepts also resolve through aliases declared by the pack, for example "postgres" → database, "queue" → inbox, "auth" → key.',
    'Unknown icons, unknown keys and dangling edge ids are rejected with a message naming the problem, so fix the spec and call again rather than guessing.',
  ].join('\n')
}

function parameters() {
  const node = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'label'],
    properties: {
      id: { type: 'string', description: 'Short unique key used by edges, e.g. "api".' },
      label: { type: 'string', description: 'Visible node caption, at most 80 characters.' },
      kind: { type: 'string', description: 'Optional small caption under the label, e.g. "service".' },
      icon: { type: 'string', description: 'Bundled icon name such as "server" or "core/database".' },
      accent: { type: 'string', enum: ['blue', 'teal', 'amber', 'rose', 'violet', 'slate'], description: 'Accent color of the icon chip.' },
      note: { type: 'string', description: 'Short remark drawn inside the box, before any list items. Merged note text is capped at 320 characters.' },
      notes: { type: 'array', items: { type: 'string' }, description: 'Up to six list items drawn after the note remark, as bullets.' },
    },
  }
  const edge = {
    type: 'object',
    additionalProperties: false,
    required: ['from', 'to'],
    properties: {
      from: { type: 'string', description: 'Source node id.' },
      to: { type: 'string', description: 'Target node id.' },
      label: { type: 'string', description: 'Optional edge caption.' },
      dashed: { type: 'boolean', description: 'Dashed line for async or optional flows.' },
    },
  }
  const group = {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'nodes'],
    properties: {
      label: { type: 'string', description: 'Frame caption.' },
      nodes: { type: 'array', items: { type: 'string' }, description: 'Node ids inside the frame.' },
      accent: { type: 'string', enum: ['blue', 'teal', 'amber', 'rose', 'violet', 'slate'] },
    },
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['spec'],
    properties: {
      spec: {
        type: 'object',
        additionalProperties: false,
        required: ['nodes', 'edges'],
        description: 'Diagram content; layout and style are fixed by the renderer.',
        properties: {
          title: { type: 'string', description: 'Heading above the diagram.' },
          direction: { type: 'string', enum: ['LR', 'TB'], description: 'Flow direction; LR by default.' },
          nodes: { type: 'array', items: node, description: 'Diagram boxes, at most 80.' },
          edges: { type: 'array', items: edge, description: 'Connections between boxes.' },
          groups: { type: 'array', items: group, description: 'Optional framed areas.' },
        },
      },
      format: { type: 'string', enum: ['both', 'svg', 'png'], description: 'Output formats; "both" by default.' },
      output: { type: 'string', description: 'Base path for the files (without extension), relative to the session directory or absolute. Defaults to diagrams/<title>.' },
    },
  }
}

function outputContract() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'files'],
    properties: {
      summary: { type: 'string' },
      files: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['path', 'format', 'bytes'],
          properties: {
            path: { type: 'string' },
            format: { type: 'string', enum: ['svg', 'png'] },
            bytes: { type: 'integer' },
            width: { type: 'integer' },
            height: { type: 'integer' },
          },
        },
      },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  }
}

function slugify(title) {
  const cleaned = title
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '')
  return cleaned.length > 0 ? cleaned : 'diagram'
}

function isInside(root, target) {
  const relative = path.relative(root, target)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function displayPath(fullPath, cwd) {
  const relative = path.relative(cwd, fullPath)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return fullPath
  return relative.split(path.sep).join('/')
}

/** Writable boundary for this call, mirroring the filesystem fence. */
function policyOf(ctx, exec) {
  const sandboxPolicy = ctx.get('sandboxPolicy')
  if (sandboxPolicy === undefined) return undefined
  try {
    return sandboxPolicy.resolve({ session: exec.agent?.session })
  } catch {
    return undefined
  }
}

function assertWritable(policy, base, exec) {
  if (policy === undefined || policy.mode === 'danger-full-access') return
  if (policy.mode === 'read-only') {
    throw new Error('diagram_render writes files, but this session is read-only. Switch the session permission preset to workspace-write or full access, then retry.')
  }
  const roots = [policy.workspaceRoot, ...(policy.additionalWritableRoots ?? [])]
  if (roots.some((root) => isInside(root, base) || root === base)) return
  throw new Error(`diagram_render cannot write to ${base}: it is outside the session workspace ${policy.workspaceRoot}. Pass an output path inside the workspace.`)
}

async function uniqueBase(base) {
  const candidates = [base]
  for (let index = 2; index < 100; index++) candidates.push(`${base}-${index}`)
  for (const candidate of candidates) {
    try {
      await fs.access(`${candidate}.svg`)
      continue
    } catch {}
    return candidate
  }
  return `${base}-${Date.now()}`
}

/**
 * Build the tool definition. Import-free on purpose: a profile-linked bundle
 * cannot resolve harness packages from its own directory.
 * @param ctx - plugin context carrying tools and optional host services.
 */
export function createDiagramTool(ctx) {
  return {
    name: TOOL_NAME,
    description: describe(),
    parameters: parameters(),
    timeoutMs: 60_000,
    isConcurrencySafe: () => false,
    output: {
      schema: outputContract(),
      render(_args, value) {
        const lines = [value.summary]
        for (const file of value.files) {
          const dimensions = file.width !== undefined && file.height !== undefined ? ` (${file.width}×${file.height})` : ''
          lines.push(`- ${file.path} — ${(file.bytes / 1024).toFixed(1)} KB${dimensions}`)
        }
        for (const warning of value.warnings ?? []) lines.push(`Warning: ${warning}`)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('diagram_render requires an agent session')
      const spec = normalizeSpec(args.spec)
      const warnings = [...spec.warnings]

      const workingDirectory = ctx.get('workingDirectory')
      let cwd = process.cwd()
      if (workingDirectory !== undefined) {
        try {
          cwd = await workingDirectory.ensure(exec.agent, exec.signal)
        } catch {}
      }

      const format = args.format ?? 'both'
      const base = (() => {
        if (typeof args.output === 'string' && args.output.trim().length > 0) {
          const raw = args.output.trim()
          const resolved = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(cwd, raw)
          return resolved.replace(/\.(svg|png)$/i, '')
        }
        return path.join(cwd, 'diagrams', slugify(spec.title || 'diagram'))
      })()

      assertWritable(policyOf(ctx, exec), base, exec)

      const diagram = buildDiagram(spec)
      warnings.push(...diagram.warnings)
      exec.signal.throwIfAborted()

      const target = await uniqueBase(base)
      const dir = path.dirname(target)
      await fs.mkdir(dir, { recursive: true })

      const files = []
      let pngError
      let png
      if (format !== 'svg') {
        try {
          png = svgToPng(diagram.svg, PNG_SCALE)
        } catch (error) {
          pngError = error instanceof Error ? error.message : String(error)
        }
      }
      if (format !== 'svg' && png === undefined && format === 'png') {
        throw new Error(pngError)
      }

      if (format !== 'png') {
        const svgPath = `${target}.svg`
        await fs.writeFile(svgPath, diagram.svg, 'utf8')
        files.push({
          path: displayPath(svgPath, cwd),
          format: 'svg',
          bytes: Buffer.byteLength(diagram.svg, 'utf8'),
          width: diagram.width,
          height: diagram.height,
        })
      }

      if (png !== undefined) {
        const pngPath = `${target}.png`
        await fs.writeFile(pngPath, png.bytes)
        files.push({
          path: displayPath(pngPath, cwd),
          format: 'png',
          bytes: png.bytes.length,
          width: png.width,
          height: png.height,
        })
      } else if (pngError !== undefined) {
        warnings.push(pngError)
      }

      const summary = `Rendered ${diagram.nodes} node${diagram.nodes === 1 ? '' : 's'} and ${diagram.edges} edge${diagram.edges === 1 ? '' : 's'}.`
      return { summary, files, warnings }
    },
  }
}
