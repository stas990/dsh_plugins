import { resolveIcon } from '../dsh-diagram/lib/icons.js'
import { normalizeSpec } from '../dsh-diagram/lib/spec.js'
import { buildDiagram } from '../dsh-diagram/lib/render.js'
import { svgToPng } from '../dsh-diagram/lib/png.js'
import fs from 'node:fs'

const cases = [
  ['postgres', 'database'],
  ['POSTGRES', 'database'],
  ['core/postgres', 'database'],
  ['queue', 'inbox'],
  ['event-bus', 'inbox'],
  ['auth', 'key'],
  ['api-key', 'key'],
  ['cache', 'zap'],
  ['payment', 'credit-card'],
  ['monitoring', 'gauge'],
  ['kafka', 'inbox'],
  ['redis', 'zap'],
  ['k8s', 'container'],
  ['jwt', 'key'],
]
for (const [name, expected] of cases) {
  try {
    const icon = resolveIcon(name)
    const ok = expected === undefined ? false : icon.id === expected
    console.log(ok ? 'ok  ' : 'FAIL', name, '->', `${icon.pack}/${icon.id}`, icon.alias ? `(alias ${icon.alias})` : '')
  } catch (error) {
    console.log('err ', name, '->', error.message.slice(0, 160))
  }
}

try {
  resolveIcon('servr')
} catch (error) {
  console.log('unknown message:', error.message)
}

const spec = normalizeSpec({
  title: 'Aliases in use',
  direction: 'LR',
  nodes: [
    { id: 'web', label: 'Web app', icon: 'browser', accent: 'blue' },
    { id: 'api', label: 'API gateway', kind: 'service', icon: 'gateway', accent: 'teal' },
    { id: 'auth', label: 'Auth', icon: 'auth', accent: 'violet' },
    { id: 'q', label: 'Event queue', icon: 'queue', accent: 'amber' },
    { id: 'db', label: 'PostgreSQL', kind: 'primary', icon: 'postgres', accent: 'teal' },
  ],
  edges: [
    { from: 'web', to: 'api', label: 'https' },
    { from: 'api', to: 'auth', label: 'verify' },
    { from: 'api', to: 'q', label: 'publish' },
    { from: 'q', to: 'db', label: 'write' },
  ],
})
console.log('spec icons:', spec.nodes.map((node) => `${node.id}=${node.iconName}`).join(', '))

const diagram = buildDiagram(spec)
fs.mkdirSync('.dev/out', { recursive: true })
fs.writeFileSync('.dev/out/aliases.svg', diagram.svg)
const png = svgToPng(diagram.svg, 2)
fs.writeFileSync('.dev/out/aliases.png', png.bytes)
console.log('rendered:', diagram.width, 'x', diagram.height)
