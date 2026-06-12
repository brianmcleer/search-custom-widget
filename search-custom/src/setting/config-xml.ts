/**
 * Lossless XML (de)serialization for the master-search customConfig.
 *
 * Why XML and not plain JSON? So a settings configuration can be exported from
 * one Experience Builder app and imported into another (different org, machine,
 * or environment) as a single portable, human-readable file. Every value is
 * tagged with its JS type so the round-trip is exact - strings, numbers,
 * booleans, arrays and nested objects all survive unchanged.
 *
 * Format:
 *   <searchCustomConfig schemaVersion="1">
 *     <enabled type="bool">true</enabled>
 *     <containerWidth type="num">300</containerWidth>
 *     <allPlaceholder type="str">Search for an address</allPlaceholder>
 *     <sources type="arr">
 *       <item type="obj">
 *         <id type="str">src_ab12</id>
 *         <kind type="str">FeatureLayer</kind>
 *         ...
 *       </item>
 *     </sources>
 *   </searchCustomConfig>
 */
import type { CustomSearchConfig } from '../config'

export const XML_ROOT = 'searchCustomConfig'
export const XML_SCHEMA_VERSION = '1'

// -------------------- serialize --------------------

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const valueToXml = (tag: string, value: any, indent: string): string => {
  const pad = indent
  if (value === null) return `${pad}<${tag} type="null"/>`
  const t = typeof value
  if (t === 'boolean') return `${pad}<${tag} type="bool">${value ? 'true' : 'false'}</${tag}>`
  if (t === 'number') return `${pad}<${tag} type="num">${value}</${tag}>`
  if (t === 'string') return `${pad}<${tag} type="str">${escapeXml(value)}</${tag}>`
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}<${tag} type="arr"/>`
    const inner = value.map(v => valueToXml('item', v, pad + '  ')).join('\n')
    return `${pad}<${tag} type="arr">\n${inner}\n${pad}</${tag}>`
  }
  if (t === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined)
    if (keys.length === 0) return `${pad}<${tag} type="obj"/>`
    const inner = keys.map(k => valueToXml(k, value[k], pad + '  ')).join('\n')
    return `${pad}<${tag} type="obj">\n${inner}\n${pad}</${tag}>`
  }
  // Fallback: stringify anything exotic.
  return `${pad}<${tag} type="str">${escapeXml(String(value))}</${tag}>`
}

/** Serialize a customConfig object to a portable XML string. */
export const configToXml = (config: CustomSearchConfig): string => {
  const keys = Object.keys(config || {}).filter(k => (config as any)[k] !== undefined)
  const body = keys.map(k => valueToXml(k, (config as any)[k], '  ')).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<${XML_ROOT} schemaVersion="${XML_SCHEMA_VERSION}">\n${body}\n</${XML_ROOT}>\n`
}

// -------------------- parse --------------------

const elementChildren = (el: Element): Element[] => {
  const out: Element[] = []
  const nodes = el.childNodes
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (n.nodeType === 1) out.push(n as Element)
  }
  return out
}

const parseElement = (el: Element): any => {
  const type = el.getAttribute('type') || 'str'
  switch (type) {
    case 'null': return null
    case 'bool': return (el.textContent || '').trim() === 'true'
    case 'num': return Number((el.textContent || '').trim())
    case 'str': return el.textContent ?? ''
    case 'arr':
      return elementChildren(el).map(parseElement)
    case 'obj': {
      const obj: Record<string, any> = {}
      for (const child of elementChildren(el)) {
        obj[child.nodeName] = parseElement(child)
      }
      return obj
    }
    default:
      return el.textContent ?? ''
  }
}

/**
 * Parse an exported XML string back into a customConfig object.
 * Throws a descriptive Error if the document is not a valid export.
 * Relies on the global DOMParser (always present in the EB settings iframe).
 */
export const xmlToConfig = (xml: string): CustomSearchConfig => {
  if (!xml || !xml.trim()) throw new Error('Empty XML.')
  const DP: any = (typeof DOMParser !== 'undefined')
    ? DOMParser
    : (globalThis as any).DOMParser
  if (!DP) throw new Error('No XML parser available in this environment.')
  const doc = new DP().parseFromString(xml, 'application/xml')

  // DOMParser reports malformed XML via a <parsererror> element.
  const perr = doc.getElementsByTagName('parsererror')
  if (perr && perr.length) throw new Error('Malformed XML - could not parse.')

  const root = doc.documentElement
  if (!root || root.nodeName !== XML_ROOT) {
    throw new Error(`Not a Search (Custom) config file - expected a <${XML_ROOT}> root element.`)
  }

  const cfg: Record<string, any> = {}
  for (const child of elementChildren(root)) {
    cfg[child.nodeName] = parseElement(child)
  }
  return cfg as CustomSearchConfig
}
