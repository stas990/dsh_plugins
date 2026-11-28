import fs from 'node:fs'
import path from 'node:path'
import { normalizeSpec } from '../dsh-diagram/lib/spec.js'
import { buildDiagram } from '../dsh-diagram/lib/render.js'
import { svgToPng } from '../dsh-diagram/lib/png.js'

const samples = {
  'pipeline-lr': {
    title: 'Ingest pipeline',
    direction: 'LR',
    nodes: [
      { id: 'client', label: 'Web client', kind: 'browser', icon: 'monitor', accent: 'blue' },
      { id: 'cdn', label: 'CDN edge', kind: 'static assets', icon: 'globe', accent: 'slate' },
      { id: 'api', label: 'API gateway', kind: 'service', icon: 'server', accent: 'blue' },
      { id: 'auth', label: 'Auth service', kind: 'tokens', icon: 'key', accent: 'violet' },
      { id: 'queue', label: 'Event queue', kind: 'kafka', icon: 'inbox', accent: 'amber' },
      { id: 'worker', label: 'Ingest worker', kind: 'consumer', icon: 'cpu', accent: 'teal' },
      { id: 'db', label: 'PostgreSQL', kind: 'primary store', icon: 'database', accent: 'teal' },
      { id: 'cache', label: 'Redis', kind: 'hot cache', icon: 'zap', accent: 'rose' },
    ],
    edges: [
      { from: 'client', to: 'cdn', label: 'assets' },
      { from: 'cdn', to: 'api', label: 'api calls' },
      { from: 'api', to: 'auth', label: 'verify' },
      { from: 'api', to: 'queue', label: 'publish' },
      { from: 'queue', to: 'worker' },
      { from: 'worker', to: 'db', label: 'write' },
      { from: 'worker', to: 'cache' },
      { from: 'cache', to: 'api', label: 'cached reads', dashed: true },
    ],
    groups: [
      { label: 'Backend', nodes: ['api', 'auth', 'queue', 'worker'], accent: 'blue' },
      { label: 'Storage', nodes: ['db', 'cache'], accent: 'teal' },
    ],
  },
  'order-tb': {
    title: 'Order lifecycle',
    direction: 'TB',
    nodes: [
      { id: 'draft', label: 'Draft', icon: 'file-text', accent: 'slate' },
      { id: 'checkout', label: 'Checkout', kind: 'client', icon: 'credit-card', accent: 'blue' },
      { id: 'payment', label: 'Payment', kind: 'provider', icon: 'shield-check', accent: 'violet' },
      { id: 'stock', label: 'Stock reservation', icon: 'boxes', accent: 'amber' },
      { id: 'shipping', label: 'Shipping', icon: 'package', accent: 'teal' },
      { id: 'done', label: 'Delivered', icon: 'circle-dot', accent: 'teal' },
    ],
    edges: [
      { from: 'draft', to: 'checkout' },
      { from: 'checkout', to: 'payment', label: 'authorize' },
      { from: 'checkout', to: 'stock', label: 'reserve' },
      { from: 'payment', to: 'shipping', label: 'capture' },
      { from: 'stock', to: 'shipping', dashed: true },
      { from: 'shipping', to: 'done' },
    ],
  },
  'onboarding-tb': {
    title: 'New customer onboarding',
    direction: 'TB',
    nodes: [
      { id: 'lead', label: 'Lead', icon: 'user', accent: 'slate' },
      { id: 'verify', label: 'Verify email', icon: 'mail', accent: 'blue' },
      { id: 'kyc', label: 'KYC check', kind: 'external', icon: 'file-text', accent: 'amber' },
      { id: 'account', label: 'Create account', icon: 'user', accent: 'blue' },
      { id: 'welcome', label: 'Welcome email', icon: 'mail', accent: 'teal' },
      { id: 'crm', label: 'CRM sync', kind: 'nightly', icon: 'refresh-cw', accent: 'violet' },
    ],
    edges: [
      { from: 'lead', to: 'verify' },
      { from: 'verify', to: 'kyc', label: 'approved' },
      { from: 'verify', to: 'account', label: 'skipped' },
      { from: 'kyc', to: 'account' },
      { from: 'account', to: 'welcome' },
      { from: 'account', to: 'crm', dashed: true },
    ],
  },
}

fs.mkdirSync('.dev/out', { recursive: true })
for (const [name, raw] of Object.entries(samples)) {
  const spec = normalizeSpec(raw)
  const diagram = buildDiagram(spec)
  const svgPath = path.resolve(`.dev/out/${name}.svg`)
  fs.writeFileSync(svgPath, diagram.svg)
  const png = svgToPng(diagram.svg, 2)
  fs.writeFileSync(path.resolve(`.dev/out/${name}.png`), png.bytes)
  console.log(name, `${diagram.width}x${diagram.height}`, 'png', `${png.width}x${png.height}`, `${png.bytes.length} bytes`)
}
