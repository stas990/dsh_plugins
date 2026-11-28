import fs from 'node:fs'

const source = JSON.parse(fs.readFileSync('tools/icon-nodes.json', 'utf8'))

const wanted = [
  'server', 'database', 'cloud', 'container', 'boxes', 'workflow',
  'git-branch', 'git-merge', 'globe', 'shield', 'shield-check', 'key',
  'lock', 'user', 'users', 'bot', 'monitor', 'smartphone', 'mail',
  'file-text', 'folder', 'search', 'clock', 'gauge', 'activity', 'zap',
  'plug', 'router', 'wifi', 'hard-drive', 'cpu', 'network', 'terminal',
  'code', 'layers', 'package', 'inbox', 'message-square', 'credit-card',
  'settings', 'bell', 'chart-line', 'pie-chart', 'share-2', 'refresh-cw',
  'download', 'upload', 'bug', 'flask-conical', 'map-pin', 'calendar',
  'eye', 'list', 'arrow-right-left', 'link-2', 'radio', 'scan-line',
  'table', 'square-stack', 'circle-dot', 'git-fork', 'split', 'shuffle',
]

// Concept aliases: what a model or a human is likely to call the thing the
// icon depicts. They resolve to the same icon, so the spec can stay semantic.
const aliases = {
  server: ['api', 'backend', 'service', 'host', 'instance'],
  database: ['db', 'sql', 'postgres', 'postgresql', 'mysql', 'mariadb', 'mongo', 'mongodb', 'oracle', 'persistence', 'store'],
  cloud: ['saas', 'external', 'internet', 'cloud-service'],
  container: ['docker', 'pod', 'runtime', 'k8s', 'kubernetes'],
  boxes: ['modules', 'inventory', 'stock'],
  workflow: ['process', 'pipeline', 'flow', 'orchestration', 'dag'],
  'git-branch': ['branch', 'repository', 'repo', 'versioning'],
  'git-merge': ['merge', 'pull-request', 'pr'],
  'git-fork': ['fork', 'split-repo'],
  globe: ['website', 'cdn', 'www', 'internet-page'],
  shield: ['security', 'protection', 'waf'],
  'shield-check': ['compliance', 'verified', 'secure-check'],
  key: ['auth', 'token', 'secret', 'credentials', 'api-key', 'jwt'],
  lock: ['private', 'encrypted', 'vault'],
  user: ['customer', 'person', 'account', 'profile'],
  users: ['team', 'group', 'audience'],
  bot: ['agent', 'assistant', 'chatbot', 'ai'],
  monitor: ['desktop', 'browser', 'frontend', 'web-ui'],
  smartphone: ['mobile', 'app', 'ios', 'android', 'phone'],
  mail: ['email', 'smtp', 'inbox-mail'],
  'file-text': ['document', 'report', 'invoice', 'log'],
  folder: ['directory', 'files', 'filesystem'],
  search: ['query', 'index', 'lookup'],
  clock: ['time', 'schedule', 'cron', 'timer'],
  gauge: ['metrics', 'monitoring', 'performance', 'load'],
  activity: ['health', 'heartbeat', 'uptime', 'pulse'],
  zap: ['cache', 'fast', 'speed', 'lightning', 'redis', 'memcached'],
  plug: ['integration', 'connector', 'adapter', 'webhook'],
  router: ['gateway', 'proxy', 'ingress'],
  wifi: ['wireless', 'network-access', 'signal-wifi'],
  'hard-drive': ['disk', 'volume', 's3', 'object-storage'],
  cpu: ['compute', 'worker', 'processor', 'job-runner'],
  network: ['cluster', 'topology', 'mesh', 'subnet'],
  terminal: ['shell', 'cli', 'command', 'console'],
  code: ['source', 'function', 'lambda', 'script'],
  layers: ['stack', 'tiers', 'layer'],
  package: ['artifact', 'bundle', 'release', 'build'],
  inbox: ['queue', 'broker', 'stream', 'event-bus', 'kafka', 'rabbitmq', 'sqs', 'nats', 'pulsar'],
  'message-square': ['chat', 'comment', 'conversation'],
  'credit-card': ['payment', 'billing', 'checkout', 'money'],
  settings: ['config', 'configuration', 'admin', 'preferences'],
  bell: ['alert', 'alarm', 'notify'],
  'chart-line': ['analytics', 'graph', 'stats', 'trend'],
  'share-2': ['sharing', 'share', 'external-link'],
  'refresh-cw': ['sync', 'retry', 'refresh', 'reload'],
  download: ['import', 'receive', 'ingest'],
  upload: ['export', 'send', 'publish'],
  bug: ['defect', 'error', 'incident'],
  'flask-conical': ['experiment', 'test', 'playground'],
  'map-pin': ['location', 'region', 'geo'],
  calendar: ['date', 'booking', 'event-date'],
  eye: ['observability', 'view', 'inspect-view'],
  list: ['tasks', 'todo', 'checklist'],
  'arrow-right-left': ['exchange', 'bidirectional'],
  'link-2': ['relationship', 'connection', 'relation', 'association'],
  radio: ['broadcast', 'signal', 'pubsub'],
  'scan-line': ['scan', 'inspect'],
  table: ['grid', 'data-table', 'dataset'],
  'square-stack': ['batch', 'stack-group'],
  'circle-dot': ['state', 'status', 'done', 'record'],
  split: ['variant', 'ab-test', 'canary'],
  shuffle: ['random', 'sampling'],
}

const missing = wanted.filter((id) => !(id in source))
console.log('missing:', missing.length ? missing.join(', ') : 'none')

const known = wanted.filter((id) => id in source)
const titleOf = (id) => id.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')

// Validate the alias table before it reaches the pack.
const seenAliases = new Map()
const withAliases = known.filter((id) => (aliases[id] ?? []).length > 0)
for (const id of withAliases) {
  for (const alias of aliases[id]) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(alias)) throw new Error(`alias "${alias}" of "${id}" is not a lowercase slug`)
    if (known.includes(alias)) throw new Error(`alias "${alias}" of "${id}" collides with an icon id`)
    if (seenAliases.has(alias)) throw new Error(`alias "${alias}" is declared by both "${seenAliases.get(alias)}" and "${id}"`)
    seenAliases.set(alias, id)
  }
}
console.log('icons:', known.length, 'with aliases:', withAliases.length, 'aliases:', seenAliases.size)

const icons = {}
for (const id of known) {
  icons[id] = { title: titleOf(id), aliases: aliases[id] ?? [], elements: source[id] }
}

const pack = {
  id: 'core',
  title: 'Core',
  license: 'Lucide (ISC) — see LICENSE-LUCIDE.txt',
  icons,
}

fs.mkdirSync('packages/diagram/icons', { recursive: true })
fs.writeFileSync('packages/diagram/icons/core.json', JSON.stringify(pack, null, 2) + '\n')
console.log('wrote', known.length, 'icons, bytes:', fs.statSync('packages/diagram/icons/core.json').size)
