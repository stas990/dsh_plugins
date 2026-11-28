import fs from 'node:fs'
import path from 'node:path'
import { normalizeSpec } from '../dsh-diagram/lib/spec.js'
import { buildDiagram } from '../dsh-diagram/lib/render.js'
import { svgToPng } from '../dsh-diagram/lib/png.js'

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

// --- validation ------------------------------------------------------------
const invalid = [
  [{ nodes: [{ id: 'a', label: 'A', notes: [] }], edges: [] }, /non-empty/],
  [{ nodes: [{ id: 'a', label: 'A', notes: ['1', '2', '3', '4', '5', '6', '7'] }], edges: [] }, /at most 6/],
  [{ nodes: [{ id: 'a', label: 'A', note: '   ' }], edges: [] }, /must not be empty/],
  [{ nodes: [{ id: 'a', label: 'A', notes: ['ok', '   '] }], edges: [] }, /must not be empty/],
]
for (const [spec, pattern] of invalid) {
  try {
    normalizeSpec(spec)
    throw new Error('should have failed')
  } catch (error) {
    assert(pattern.test(error.message), `unexpected: ${error.message}`)
  }
}
console.log('notes validation: ok')

// --- both fields merge, note first ----------------------------------------
const merged = normalizeSpec({
  nodes: [{ id: 'a', label: 'A', note: 'Short role', notes: ['one', 'two'] }],
  edges: [],
}).nodes[0]
assert(merged.noteParagraph === 'Short role', `paragraph: ${merged.noteParagraph}`)
assert(JSON.stringify(merged.noteItems) === JSON.stringify(['one', 'two']), `items: ${merged.noteItems}`)
console.log('merge order: ok')

// --- merged text is measured after merging ---------------------------------
const big = normalizeSpec({
  nodes: [{ id: 'a', label: 'A', note: 'А'.repeat(300), notes: ['x'.repeat(40), 'y'.repeat(40)] }],
  edges: [],
}).nodes[0]
assert(big.noteParagraph.length === 300, `paragraph length ${big.noteParagraph.length}`)
assert(big.noteItems.length === 1, `items kept ${big.noteItems.join('|')}`)
assert(big.noteItems[0].endsWith('…'), 'the cut item ends with an ellipsis')
console.log('merge budget: ok, kept:', JSON.stringify(big.noteItems[0]))

// --- rendering -------------------------------------------------------------
const render = (name, raw) => {
  const spec = normalizeSpec(raw)
  const diagram = buildDiagram(spec)
  fs.mkdirSync('.dev/out', { recursive: true })
  fs.writeFileSync(path.resolve(`.dev/out/${name}.svg`), diagram.svg)
  const png = svgToPng(diagram.svg, 2)
  fs.writeFileSync(path.resolve(`.dev/out/${name}.png`), png.bytes)
  console.log(name, `${diagram.width}x${diagram.height}`, 'warnings:', diagram.warnings.length)
}

render('notesBoth', {
  title: 'Note and list',
  direction: 'LR',
  nodes: [
    {
      id: 'api',
      label: 'API gateway',
      kind: 'service',
      icon: 'server',
      accent: 'blue',
      note: 'Accepts HTTPS and routes requests to backend services.',
      notes: ['Validates tokens', 'Rate limits clients'],
    },
    {
      id: 'db',
      label: 'PostgreSQL',
      icon: 'database',
      accent: 'teal',
      notes: ['Primary store', 'Read replica in EU'],
    },
  ],
  edges: [{ from: 'api', to: 'db', label: 'sql' }],
})
