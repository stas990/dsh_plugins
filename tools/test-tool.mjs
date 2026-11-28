import fs from 'node:fs'
import path from 'node:path'
import { createDiagramTool } from '../packages/diagram/lib/tool.js'
import { normalizeSpec } from '../packages/diagram/lib/spec.js'
import { buildDiagram } from '../packages/diagram/lib/render.js'
import { svgToPng } from '../packages/diagram/lib/png.js'

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

// --- spec validation -------------------------------------------------------
const bad = [
  [{ nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'b' }] }, /existing node/],
  [{ nodes: [{ id: 'a', label: 'A', icon: 'nope' }], edges: [] }, /unknown icon/],
  [{ nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }], edges: [] }, /duplicates/],
  [{ nodes: [{ id: 'a', label: 'A', colour: 'red' }], edges: [] }, /unknown key/],
]
for (const [spec, pattern] of bad) {
  try {
    normalizeSpec(spec)
    throw new Error('should have failed')
  } catch (error) {
    assert(pattern.test(error.message), `unexpected message: ${error.message}`)
  }
}
console.log('spec validation: ok')

// --- a Russian, no-icon, skipping-edge diagram -----------------------------
const cyrillic = {
  title: 'Поток заявки',
  direction: 'LR',
  nodes: [
    { id: 'in', label: 'Новая заявка', kind: 'web', accent: 'blue' },
    { id: 'check', label: 'Проверка данных', kind: 'automated', accent: 'amber' },
    { id: 'manual', label: 'Ручная проверка', kind: 'operator', accent: 'violet' },
    { id: 'ok', label: 'Одобрено', accent: 'teal' },
    { id: 'no', label: 'Отказано', accent: 'rose' },
  ],
  edges: [
    { from: 'in', to: 'check' },
    { from: 'check', to: 'ok', label: 'ok' },
    { from: 'manual', to: 'no', label: 'нет' },
    { from: 'in', to: 'manual', dashed: true },
  ],
  groups: [{ label: 'Автоматика', nodes: ['check'], accent: 'amber' }],
}
const spec = normalizeSpec(cyrillic)
const diagram = buildDiagram(spec)
fs.mkdirSync('tools/out', { recursive: true })
const svgPath = path.resolve('tools/out/cyrillic-lr.svg')
fs.writeFileSync(svgPath, diagram.svg)
const png = svgToPng(diagram.svg, 2)
fs.writeFileSync(path.resolve('tools/out/cyrillic-lr.png'), png.bytes)
console.log('cyrillic:', diagram.width, 'x', diagram.height, 'png', png.width, 'x', png.height)

// --- the tool end to end without host services ------------------------------
const ctx = { get: () => undefined }
const tool = createDiagramTool(ctx)
const exec = { agent: { id: 'test-agent' }, signal: AbortSignal.timeout(30_000) }
const result = await tool.execute({ spec: cyrillic, output: 'tools/out/order-flow', format: 'both' }, exec)
console.log('tool result:', JSON.stringify(result, null, 2))
for (const file of result.files) assert(fs.existsSync(path.resolve(file.path)), `missing ${file.path}`)

// --- read-only sessions refuse to write ------------------------------------
const readOnlyTool = createDiagramTool({
  get(name) {
    if (name === 'sandboxPolicy') return { resolve: () => ({ mode: 'read-only', workspaceRoot: process.cwd() }) }
    return undefined
  },
})
try {
  await readOnlyTool.execute({ spec: cyrillic, output: 'tools/out/denied' }, exec)
  throw new Error('read-only write should have failed')
} catch (error) {
  assert(/read-only/.test(error.message), `unexpected message: ${error.message}`)
  assert(!fs.existsSync(path.resolve('tools/out/denied.svg')), 'denied write must not create files')
}
console.log('read-only guard: ok')
