/**
 * Helpers for the configurable Search widget.
 *
 * Everything here is driven by `CustomSearchConfig` so that behaviors that
 * would otherwise be hardcoded in a widget's runtime (search source lists,
 * popup templates, spatial-lookup messages, URL formatting) can instead be
 * configured entirely in the widget settings panel.
 */
import {
  type CustomSearchConfig,
  type UrlRule,
  type LookupRuleConfig,
  LookupOutputType
} from '../config'

// ---------------------------------------------------------------------------
// String / token helpers
// ---------------------------------------------------------------------------

/** Escape a value for safe embedding inside an Arcade double-quoted string. */
const escapeArcade = (s: string): string =>
  String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')

/**
 * Replace message tokens.
 *   {result}     -> the result/address name
 *   {field:NAME} -> attribute NAME of the matched feature (blank if missing)
 */
export const applyTokens = (
  template: string,
  resultName: string,
  attributes: Record<string, any> = {}
): string => {
  if (!template) return ''
  return template
    .replace(/\{result\}/g, resultName ?? '')
    .replace(/\{field:([^}]+)\}/g, (_m, name) => {
      const v = attributes?.[name]
      return v === null || v === undefined ? '' : String(v)
    })
}

// ---------------------------------------------------------------------------
// URL formatting (shared by LayerTemplate Arcade and SpatialLookup JS)
// ---------------------------------------------------------------------------

const matches = (lower: string, rule: UrlRule): boolean => {
  const p = rule.pattern.toLowerCase()
  switch (rule.matchType) {
    case 'startsWith': return lower.startsWith(p)
    case 'endsWith': return lower.endsWith(p)
    case 'contains': return lower.includes(p)
    default: return false
  }
}

/** Does this value look like a link according to the configured rules? */
export const isUrlValue = (value: any, rules: UrlRule[] = []): boolean => {
  const lower = String(value).toLowerCase()
  return rules.some(r => matches(lower, r))
}

/** Build the <a> markup for a value using the first matching rule (JS side). */
export const formatUrlValueJS = (
  label: string,
  value: string,
  rules: UrlRule[] = []
): string => {
  const lower = value.toLowerCase()
  const rule = rules.find(r => matches(lower, r))
  const href = rule && rule.baseUrl ? `${rule.baseUrl}${value}` : value
  const text = (rule && rule.linkText) || 'Open link'
  const aria = `${label}, opens in a new tab`
  return `<div style="margin:0;padding:0;line-height:1.2;"><b>${label}:</b> ` +
    `<a target="_blank" rel="noopener noreferrer" aria-label="${aria}" href="${href}">${text}</a></div>`
}

// ---------------------------------------------------------------------------
// Arcade popup expression (LayerTemplate mode)
// ---------------------------------------------------------------------------

/**
 * Generate the Arcade expression that lists every non-excluded field, applying
 * the configured URL rules, date formatting and coded-value lookups. This is a
 * config-driven generalisation of the expression that was hardcoded in
 * search-custom / search-custom-external.
 */
export const buildArcadeExpression = (config: CustomSearchConfig): string => {
  const exclude = (config.arcadeFieldsToExclude && config.arcadeFieldsToExclude.length
    ? config.arcadeFieldsToExclude
    : ['OBJECTID', 'SHAPE', 'GLOBALID'])
    .map(f => `"${escapeArcade(f.toUpperCase())}"`)
    .join(', ')

  const rules = config.urlRules || []

  // isURLValue() body
  const isUrlChecks = rules.map(r => {
    const p = escapeArcade(r.pattern.toLowerCase())
    const n = r.pattern.length
    if (r.matchType === 'startsWith') return `if (Left(lv, ${n}) == "${p}") { return true; }`
    if (r.matchType === 'endsWith') return `if (Right(lv, ${n}) == "${p}") { return true; }`
    return `if (Find("${p}", lv) != -1) { return true; }`
  }).join('\n    ')

  // formatURL() body
  const formatChecks = rules.map(r => {
    const p = escapeArcade(r.pattern.toLowerCase())
    const n = r.pattern.length
    const text = escapeArcade(r.linkText || 'Open link')
    const href = r.baseUrl
      ? `"${escapeArcade(r.baseUrl)}" + valText`
      : 'valText'
    const ret = `return "<b>" + urlLabel + ":</b> <a target='_blank' rel='noopener noreferrer' aria-label='" + urlLabel + ", opens in a new tab' href='" + ${href} + "'>${text}</a><br/>";`
    if (r.matchType === 'startsWith') return `if (Left(lowerValue, ${n}) == "${p}") { ${ret} }`
    if (r.matchType === 'endsWith') return `if (Right(lowerValue, ${n}) == "${p}") { ${ret} }`
    return `if (Find("${p}", lowerValue) != -1) { ${ret} }`
  }).join('\n    else ')

  return `var fieldsToExclude = [${exclude}];
var content = "";
var seenUrls = {};

function formatURL(urlLabel, urlValue) {
    var valText = Text(urlValue);
    var lowerValue = Lower(valText);
    ${formatChecks ? formatChecks + '\n    else ' : ''}{
        return "<b>" + urlLabel + ":</b> <a target='_blank' rel='noopener noreferrer' aria-label='" + urlLabel + ", opens in a new tab' href='" + valText + "'>Open link</a><br/>";
    }
}

function formatDate(dateVal) {
    if (IsEmpty(dateVal)) { return ""; }
    var d = Date(dateVal);
    return Text(d, "MM/DD/YYYY");
}

function getDomainDesc(fldInfo, fldValue) {
    if (fldInfo == null) { return fldValue; }
    if (!HasKey(fldInfo, "domain")) { return fldValue; }
    var dom = fldInfo["domain"];
    if (dom == null) { return fldValue; }
    if (!HasKey(dom, "codedValues")) { return fldValue; }
    var codedVals = dom["codedValues"];
    if (codedVals == null) { return fldValue; }
    for (var k = 0; k < Count(codedVals); k++) {
        var cv = codedVals[k];
        if (cv != null && HasKey(cv, "code") && cv["code"] == fldValue) {
            if (HasKey(cv, "name")) { return cv["name"]; }
        }
    }
    return fldValue;
}

function isURLValue(val) {
    var lv = Lower(Text(val));
    ${isUrlChecks}
    return false;
}

Expects($feature, "*");

var schemaDict = Schema($feature);
var fieldsArray = schemaDict["fields"];

for (var i = 0; i < Count(fieldsArray); i++) {
    var fld = fieldsArray[i];
    if (fld == null) { continue; }

    var fldName = "";
    var fldAlias = "";
    var fldType = "";

    if (HasKey(fld, "name")) { fldName = fld["name"]; }
    if (HasKey(fld, "alias")) { fldAlias = fld["alias"]; }
    if (HasKey(fld, "type")) { fldType = fld["type"]; }

    if (IsEmpty(fldName)) { continue; }
    if (IsEmpty(fldAlias) || fldAlias == null || fldAlias == fldName) {
        fldAlias = Replace(fldName, "_", " ");
    }

    var fldValue = $feature[fldName];

    if (IndexOf(fieldsToExclude, Upper(fldName)) == -1 && !IsEmpty(fldValue) && Upper(Text(fldValue)) != "NULL") {
        if (isURLValue(fldValue)) {
            var valKey = Text(fldValue);
            if (!HasKey(seenUrls, valKey)) {
                content += formatURL(fldAlias, fldValue);
                seenUrls[valKey] = true;
            }
        } else if (fldType == "esriFieldTypeDate") {
            content += "<b>" + fldAlias + ":</b> " + formatDate(fldValue) + "<br/>";
        } else if (HasKey(fld, "domain") && fld["domain"] != null) {
            var domDesc = getDomainDesc(fld, fldValue);
            content += "<b>" + fldAlias + ":</b> " + Text(domDesc) + "<br/>";
        } else {
            content += "<b>" + fldAlias + ":</b> " + Text(fldValue) + "<br/>";
        }
    }
}

return { type: 'text', text: content };`
}

// ---------------------------------------------------------------------------
// Spatial-lookup HTML (SpatialLookup mode)
// ---------------------------------------------------------------------------

const formatDateJS = (value: any): string => {
  const d = new Date(value)
  return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()
}

/** Build the inside/outside boundary message for an InOutMessage rule. */
const buildInOutHtml = (
  rule: LookupRuleConfig,
  resultName: string,
  matchedAttrs: Record<string, any> | null,
  rules: UrlRule[]
): string => {
  if (matchedAttrs) {
    const msg = applyTokens(rule.insideMessage || '', resultName, matchedAttrs)
    let html = `<div style="margin:0;padding:0;line-height:1.3;"><b>${msg}</b></div>`
    for (const line of rule.staticLines || []) {
      if (line.isLink) {
        const href = line.href || line.value
        const aria = `${line.label}, opens in a new tab`
        html += `<div style="margin:0;padding:0;line-height:1.2;"><b>${line.label}:</b> ` +
          `<a target="_blank" rel="noopener noreferrer" aria-label="${aria}" href="${href}">${line.value}</a></div>`
      } else {
        html += `<div style="margin:0;padding:0;line-height:1.2;"><b>${line.label}:</b> ${line.value}</div>`
      }
    }
    return html
  }
  const out = applyTokens(rule.outsideMessage || '', resultName, {})
  return `<div style="margin:0;padding:0;line-height:1.3;"><b>${out}</b></div>`
}

/** Build a field list for a FieldList rule from a matched feature. */
const buildFieldListHtml = (
  rule: LookupRuleConfig,
  layerFields: any[],
  attrs: Record<string, any> | null,
  rules: UrlRule[]
): string => {
  if (!attrs) {
    return rule.noResultMessage
      ? `<div style="margin:0;padding:0;line-height:1.2;">${rule.noResultMessage}</div>`
      : ''
  }

  const exclude = (rule.excludedFields || []).map(f => f.toUpperCase())
  const explicit = !rule.includeAllFields && rule.fields && rule.fields.length
    ? rule.fields
    : null
  const seenUrls: Record<string, boolean> = {}
  let body = ''

  // Determine iteration order: explicit list, else all layer fields.
  const iterate: Array<{ name: string, label?: string }> = explicit
    ? explicit.map(f => ({ name: f.field, label: f.label }))
    : (layerFields || []).map(f => ({ name: f.name }))

  for (const item of iterate) {
    const fieldDef = (layerFields || []).find(f => f.name === item.name)
    const name = item.name
    const upper = name.toUpperCase()
    const alias = item.label || fieldDef?.alias || name
    const val = attrs[name]

    const empty = val === null || val === undefined || String(val).toUpperCase() === 'NULL'
    if (empty) continue
    if (!explicit && exclude.includes(upper)) continue

    const valStr = String(val)

    if ((rule.applyUrlRules ?? true) && isUrlValue(valStr, rules)) {
      if (!seenUrls[valStr]) {
        body += formatUrlValueJS(alias, valStr, rules)
        seenUrls[valStr] = true
      }
    } else if ((rule.applyDateFormatting ?? true) && fieldDef?.type === 'date') {
      body += `<div style="margin:0;padding:0;line-height:1.2;"><b>${alias}:</b> ${formatDateJS(val)}</div>`
    } else if ((rule.applyCodedValues ?? true) && fieldDef?.domain?.type === 'coded-value') {
      const coded = fieldDef.domain.codedValues.find((cv: any) => cv.code === val)
      body += `<div style="margin:0;padding:0;line-height:1.2;"><b>${alias}:</b> ${coded ? coded.name : val}</div>`
    } else {
      body += `<div style="margin:0;padding:0;line-height:1.2;"><b>${alias}:</b> ${val}</div>`
    }
  }

  if (!body) return ''
  if (rule.sectionHeading) {
    return `<h4 style="margin:0 0 4px 0;padding:0;line-height:1.3;"><b>${rule.sectionHeading}</b></h4>${body}`
  }
  return body
}

/** Build the HTML for one lookup rule given the queried feature attributes. */
export const buildLookupRuleHtml = (
  rule: LookupRuleConfig,
  resultName: string,
  attrs: Record<string, any> | null,
  layerFields: any[],
  rules: UrlRule[]
): string => {
  if (rule.outputType === LookupOutputType.InOutMessage) {
    return buildInOutHtml(rule, resultName, attrs, rules)
  }
  return buildFieldListHtml(rule, layerFields, attrs, rules)
}
