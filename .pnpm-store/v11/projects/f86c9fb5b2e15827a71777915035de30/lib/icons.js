/**
 * Icon packs are plain JSON files in the bundle's icons directory. A pack has
 * an id, a title, and icons keyed by name; each icon keeps the Lucide-style
 * element list ([tag, attributes]) so new packs can be added without code.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const packsDir = path.resolve(here, '..', 'icons')

let cache

/** Load every well-formed pack exactly once. */
export function loadIconPacks() {
  if (cache) return cache
  const packs = new Map()
  let files = []
  try {
    files = fs.readdirSync(packsDir).filter((file) => file.endsWith('.json')).sort()
  } catch {
    files = []
  }
  for (const file of files) {
    try {
      const pack = JSON.parse(fs.readFileSync(path.join(packsDir, file), 'utf8'))
      if (pack && typeof pack.id === 'string' && pack.icons && typeof pack.icons === 'object') packs.set(pack.id, pack)
    } catch {
      // A malformed pack must not take the whole tool down.
    }
  }
  cache = packs
  return packs
}

/** Every usable `pack/name` reference, sorted. */
export function listIconIds() {
  const ids = []
  for (const [packId, pack] of loadIconPacks()) {
    for (const iconId of Object.keys(pack.icons)) ids.push(`${packId}/${iconId}`)
  }
  return ids.sort()
}

/** Human-readable titles for the detail document. */
export function listIconTitles() {
  const rows = []
  for (const [packId, pack] of loadIconPacks()) {
    for (const [iconId, icon] of Object.entries(pack.icons)) {
      rows.push({ id: `${packId}/${iconId}`, title: icon.title ?? iconId })
    }
  }
  return rows
}

/** Levenshtein distance, used only for a helpful error message. */
function distance(a, b) {
  const rows = a.length + 1
  const cols = b.length + 1
  let previous = Array.from({ length: cols }, (_, i) => i)
  for (let i = 1; i < rows; i++) {
    const current = [i]
    for (let j = 1; j < cols; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[cols - 1]
}

/** Lowercase alias → icon id, built once per pack. */
function aliasIndex(pack) {
  if (pack.aliasIndex instanceof Map) return pack.aliasIndex
  const index = new Map()
  for (const [id, icon] of Object.entries(pack.icons)) {
    for (const alias of icon.aliases ?? []) {
      if (typeof alias === 'string' && alias.length > 0 && !index.has(alias.toLowerCase())) {
        index.set(alias.toLowerCase(), id)
      }
    }
  }
  pack.aliasIndex = index
  return index
}

/** Nearest ids and aliases, rendered as `"pack/id"` for an error message. */
function nearestEntries(pack, packId, wanted) {
  const candidates = []
  for (const id of Object.keys(pack.icons)) {
    candidates.push({ text: `"${packId}/${id}"`, score: distance(wanted, id) })
    for (const alias of pack.icons[id].aliases ?? []) {
      candidates.push({ text: `"${packId}/${id}" (alias "${alias}")`, score: distance(wanted, alias) + 1 })
    }
  }
  const seen = new Set()
  return candidates
    .sort((a, b) => a.score - b.score)
    .filter((candidate) => {
      if (seen.has(candidate.text)) return false
      seen.add(candidate.text)
      return true
    })
    .slice(0, 4)
    .map((candidate) => candidate.text)
}

/**
 * Resolve `name`, `pack/name` or a concept alias; throws with the nearest known
 * ids. Aliases are declared by the pack itself, so a new pack extends the
 * vocabulary without a code change.
 */
export function resolveIcon(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('invalid diagram: `icon` must be a non-empty string like "core/server"')
  }
  const packs = loadIconPacks()
  const trimmed = name.trim()
  const slash = trimmed.indexOf('/')
  const packId = slash === -1 ? 'core' : trimmed.slice(0, slash)
  const iconId = slash === -1 ? trimmed : trimmed.slice(slash + 1)
  const wanted = iconId.toLowerCase()

  const pack = packs.get(packId)
  if (!pack) {
    throw new Error(`invalid diagram: unknown icon pack "${packId}"; available packs: ${[...packs.keys()].join(', ') || '(none)'}`)
  }

  if (pack.icons[iconId]) {
    const icon = pack.icons[iconId]
    return { pack: packId, id: iconId, title: icon.title ?? iconId, elements: icon.elements ?? [] }
  }

  const viaAlias = aliasIndex(pack).get(wanted)
  if (viaAlias !== undefined) {
    const icon = pack.icons[viaAlias]
    return { pack: packId, id: viaAlias, title: icon.title ?? viaAlias, elements: icon.elements ?? [], alias: iconId }
  }

  // A bare name may also live in another pack, by id or by alias.
  if (slash === -1) {
    const matches = []
    for (const [otherPackId, otherPack] of packs) {
      if (otherPackId === packId) continue
      if (otherPack.icons[iconId]) matches.push({ pack: otherPackId, id: iconId })
      else {
        const id = aliasIndex(otherPack).get(wanted)
        if (id !== undefined) matches.push({ pack: otherPackId, id })
      }
    }
    if (matches.length === 1) {
      const [match] = matches
      const icon = packs.get(match.pack).icons[match.id]
      return { pack: match.pack, id: match.id, title: icon.title ?? match.id, elements: icon.elements ?? [] }
    }
    if (matches.length > 1) {
      const options = matches.map((match) => `"${match.pack}/${match.id}"`).join(', ')
      throw new Error(`invalid diagram: "${trimmed}" is ambiguous; choose one of ${options}`)
    }
  }

  const nearest = nearestEntries(pack, packId, wanted)
  throw new Error(`invalid diagram: unknown icon "${trimmed}"${nearest.length ? `; nearest: ${nearest.join(', ')}` : ''}`)
}
