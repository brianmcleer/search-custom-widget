/** @jsx jsx */
import {
  jsx, css, React, Immutable,
  DataSourceManager, DataSourceTypes, type UseDataSource
} from 'jimu-core'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { DataSourceSelector } from 'jimu-ui/advanced/data-source-selector'
import {
  TextInput, TextArea, NumericInput, Select, Option, Switch, Button,
  CollapsablePanel, Label, UrlInput
} from 'jimu-ui'
import {
  type IMConfig,
  type CustomSearchConfig,
  type CustomSearchSource,
  type LookupRuleConfig,
  type UrlRule,
  CustomPopupMode,
  CustomSourceKind,
  LookupOutputType
} from '../config'
import { configToXml, xmlToConfig } from './config-xml'
import { buildArcadeExpression } from '../runtime/custom-search'
import { hooks as __exbI18nHooks } from 'jimu-core';
import __exbI18nMessages from './translations/default';
import { __setIntl, __t, __tc } from './i18n-t'


// Mode B leftover (WIDGETHANDOFF 12.3): AllWidgetSettingProps from
// jimu-for-builder is a shorthand module under the shim and cannot be used as a
// generic type (TS2709), so the setting props are declared structurally here.
type SettingProps = {
  id: string
  config: IMConfig
  onSettingChange: (settings: any, ...rest: any[]) => void
  useMapWidgetIds?: string[]
  useDataSources?: UseDataSource[]
  intl?: any
  theme?: any
  portalUrl?: string
  [key: string]: any
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`

const defaultCustom = (): CustomSearchConfig => ({
  enabled: true,
  containerWidth: 300,
  allPlaceholder: 'Search for an address',
  includeDefaultSources: false,
  defaultZoomScale: 1000,
  autoSelect: true,
  searchAllEnabled: true,
  resultGraphicEnabled: true,
  popupEnabled: true,
  locationEnabled: false,
  suggestionsEnabled: true,
  minSuggestCharacters: 1,
  maxResults: 6,
  maxSuggestions: 6,
  initialSearchTerm: '',
  activeSourceIndex: -1,
  searchHistoryEnabled: false,
  searchHistoryMax: 5,
  autoNavigate: true,
  navigateMode: 'scale',
  barStyle: 'default',
  barSize: 'comfortable',
  barAccent: '#003A55',
  popupOpenOnSelect: true,
  zoomAnimate: false,
  zoomDuration: 500,
  placement: 'widget',
  mapPosition: 'top-left',
  popupMode: CustomPopupMode.LayerTemplate,
  popupTitleTemplate: '{LOCATION}',
  arcadeFieldsToExclude: ['OBJECTID', 'OBJECTID_1', 'SHAPE', 'GLOBALID'],
  spatialPopupTitle: '{result}',
  sources: [],
  lookupRules: [],
  urlRules: []
})

const Setting = (props: SettingProps) => {
  __setIntl((props as any).intl)
  const t = __exbI18nHooks.useTranslation(__exbI18nMessages);
  const { config, id, useMapWidgetIds, onSettingChange } = props

  // Work on a plain-object copy; write back wholesale on each change.
  const custom: CustomSearchConfig = config?.customConfig
    ? (config.customConfig as any).asMutable({ deep: true })
    : defaultCustom()

  const commit = (next: CustomSearchConfig) => {
    onSettingChange({ id, config: config.set('customConfig', Immutable(next)) })
  }
  const patch = (changes: Partial<CustomSearchConfig>) => commit({ ...custom, ...changes })
  const patchPopup = (changes: any) => patch({ popupOptions: { ...(custom.popupOptions || {}), ...changes } })

  // ---------------- Export / Import (XML) ----------------
  const [transferOpen, setTransferOpen] = React.useState(false)
  const [importText, setImportText] = React.useState('')
  const [transferMsg, setTransferMsg] = React.useState<{ kind: 'ok' | 'err', text: string } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  // Source-card UI state: which cards are expanded, and drag-reorder tracking.
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [armedIdx, setArmedIdx] = React.useState<number | null>(null)
  const [draggingIdx, setDraggingIdx] = React.useState<number | null>(null)
  const [overIdx, setOverIdx] = React.useState<number | null>(null)
  const [showDsPicker, setShowDsPicker] = React.useState(false)

  const currentXml = React.useMemo(() => {
    try { return configToXml(custom) } catch { return '' }
  }, [custom])

  const downloadXml = () => {
    try {
      const xml = configToXml(custom)
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `search-custom-config-${new Date().toISOString().slice(0, 10)}.xml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setTransferMsg({ kind: 'ok', text: __t("configurationExported") })
    } catch (e) {
      setTransferMsg({ kind: 'err', text: 'Export failed: ' + (e?.message || e) })
    }
  }

  const applyImport = (xml: string) => {
    try {
      const incoming = xmlToConfig(xml)
      if (!incoming || typeof incoming !== 'object') throw new Error('No configuration found.')
      // Merge onto defaults so any field absent in an older export is sensibly filled.
      const merged: CustomSearchConfig = { ...defaultCustom(), ...incoming }
      commit(merged)
      setTransferMsg({ kind: 'ok', text: __t("configurationImportedAndApplied") })
      setImportText('')
    } catch (e) {
      setTransferMsg({ kind: 'err', text: 'Import failed: ' + (e?.message || e) })
    }
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => applyImport(String(reader.result || ''))
    reader.onerror = () => setTransferMsg({ kind: 'err', text: __t("couldNotReadTheSelectedFile") })
    reader.readAsText(file)
    e.target.value = '' // allow re-selecting the same file
  }


  const onMapWidgetSelected = (ids: string[]) => {
    onSettingChange({ id, useMapWidgetIds: ids })
  }

  // helpers for comma lists
  const toList = (s: string): string[] =>
    s.split(',').map(x => x.trim()).filter(Boolean)
  const fromList = (a?: string[]): string => (a || []).join(', ')

  // ---------------- Sources ----------------
  const updateSource = (i: number, changes: Partial<CustomSearchSource>) => {
    const sources = [...(custom.sources || [])]
    sources[i] = { ...sources[i], ...changes }
    patch({ sources })
  }
  const addSource = (kind: CustomSourceKind) => {
    const sources = [...(custom.sources || [])]
    const id = uid('src')
    sources.push(kind === CustomSourceKind.Geocode
      ? { id, kind, name: 'Locator', url: '', singleLineFieldName: 'SingleLine', maxSuggestions: 10, maxResults: 5, suggest: true }
      : { id, kind, name: 'Layer', url: '', searchFields: [], displayField: '', exactMatch: false, zoomScale: custom.defaultZoomScale ?? 1000 })
    setExpandedIds(prev => new Set(prev).add(id)) // open the new card so it's ready to edit
    patch({ sources })
  }
  const removeSource = (i: number) => {
    const sources = [...(custom.sources || [])]
    sources.splice(i, 1)
    patch({ sources })
  }

  // ---- Source card UI: collapse/expand + drag-to-reorder ----
  const setExpanded = (id: string, open: boolean) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      open ? next.add(id) : next.delete(id)
      return next
    })
  }
  const setAllExpanded = (open: boolean) => {
    setExpandedIds(open ? new Set((custom.sources || []).map(s => s.id)) : new Set())
  }
  const reorderSource = (from: number, to: number) => {
    if (from == null || to == null || from === to) return
    const sources = [...(custom.sources || [])]
    const [moved] = sources.splice(from, 1)
    sources.splice(to, 0, moved)
    patch({ sources })
  }

  // --- EB data sources ---------------------------------------------------
  // Keep the widget's useDataSources (managed by Experience Builder) in sync
  // with our DataSource-kind search sources, committing both in one change so
  // they can't clobber each other.
  const onDataSourcesChange = (useDataSources: UseDataSource[]) => {
    const uds = useDataSources || []
    const selectedIds = uds.map(u => u.dataSourceId)
    // Drop DataSource sources whose data source was deselected.
    let sources = (custom.sources || []).filter(
      s => s.kind !== CustomSourceKind.DataSource || selectedIds.indexOf(s.dataSourceId) !== -1
    )
    // Add a source for each newly selected data source.
    const present = new Set(
      sources.filter(s => s.kind === CustomSourceKind.DataSource).map(s => s.dataSourceId)
    )
    uds.forEach(u => {
      if (!present.has(u.dataSourceId)) {
        let label = u.dataSourceId
        try {
          const ds: any = DataSourceManager.getInstance().getDataSource(u.dataSourceId)
          if (ds?.getLabel) label = ds.getLabel() || label
        } catch { /* not yet created */ }
        sources.push({
          id: uid('src'), kind: CustomSourceKind.DataSource, name: label,
          dataSourceId: u.dataSourceId, url: '', searchFields: [], displayField: '',
          exactMatch: false, zoomScale: custom.defaultZoomScale ?? 1000
        })
      }
    })
    const next = { ...custom, sources }
    onSettingChange({ id, useDataSources: uds, config: config.set('customConfig', Immutable(next)) })
  }

  // ---------------- Lookup rules ----------------
  const updateRule = (i: number, changes: Partial<LookupRuleConfig>) => {
    const lookupRules = [...(custom.lookupRules || [])]
    lookupRules[i] = { ...lookupRules[i], ...changes }
    patch({ lookupRules })
  }
  const addRule = () => {
    const lookupRules = [...(custom.lookupRules || [])]
    lookupRules.push({
      id: uid('rule'),
      enabled: true,
      layerUrl: '',
      spatialRelationship: 'intersects',
      outputType: LookupOutputType.InOutMessage,
      insideMessage: 'The address {result} is within the {field:DISTRICT}.',
      outsideMessage: 'The address {result} is outside the boundary.',
      includeAllFields: true,
      excludedFields: ['OBJECTID', 'SHAPE', 'GLOBALID'],
      applyUrlRules: true,
      applyDateFormatting: true,
      applyCodedValues: true
    })
    patch({ lookupRules })
  }
  const removeRule = (i: number) => {
    const lookupRules = [...(custom.lookupRules || [])]
    lookupRules.splice(i, 1)
    patch({ lookupRules })
  }

  // ---------------- URL rules ----------------
  const updateUrlRule = (i: number, changes: Partial<UrlRule>) => {
    const urlRules = [...(custom.urlRules || [])]
    urlRules[i] = { ...urlRules[i], ...changes }
    patch({ urlRules })
  }
  const addUrlRule = () => {
    const urlRules = [...(custom.urlRules || [])]
    urlRules.push({ id: uid('url'), matchType: 'startsWith', pattern: 'http', baseUrl: '', linkText: 'Open link' })
    patch({ urlRules })
  }
  const removeUrlRule = (i: number) => {
    const urlRules = [...(custom.urlRules || [])]
    urlRules.splice(i, 1)
    patch({ urlRules })
  }

  // JSON editor for advanced nested arrays (staticLines / explicit field list)
  const jsonField = (value: any, onValid: (v: any) => void, rowsHint = 3) => (
    <TextArea
      aria-label={t('advancedConfigurationValueJson')}
      css={{ minHeight: `${Math.max(rowsHint * 22, 28)}px`, width: '100%' }}
      defaultValue={value ? JSON.stringify(value, null, 0) : ''}
      onAcceptValue={(v: string) => {
        if (!v.trim()) { onValid(undefined); return }
        try { onValid(JSON.parse(v)) } catch { /* ignore invalid JSON */ }
      }}
    />
  )

  const STYLE = css`
    .row-label { font-weight: 600; }
    .card { border: 1px solid var(--ref-palette-neutral-500); border-radius: 4px; padding: 8px; margin-bottom: 8px; background: var(--ref-palette-neutral-100, #fff); }
    .card .title { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
    .hint { color: var(--ref-palette-neutral-900); font-size: 12px; margin: 4px 0; }
    .mini-label { font-size: 12px; margin-top: 6px; }
    .btn-row { display:flex; gap:6px; flex-wrap:wrap; margin: 6px 0; }
    .xml-box textarea { font-family: var(--ref-typeface-font-family-mono, monospace); font-size: 11px; }
    .msg { font-size: 12px; padding: 6px 8px; border-radius: 4px; margin: 6px 0; }
    .msg.ok { background: var(--ref-palette-secondary-100, #e9f6ec); color: var(--ref-palette-success-700, #0a7227); }
    .msg.err { background: var(--ref-palette-danger-100, #fdeaea); color: var(--ref-palette-danger-700, #b3261e); }

    /* Sortable source cards built around jimu CollapsablePanel */
    .src-card { transition: box-shadow .12s ease, border-color .12s ease; padding: 4px 6px; }
    .src-card.dragging { opacity: .55; }
    .src-card.drag-over { border-color: var(--sys-color-primary, #076fe5); box-shadow: 0 -2px 0 0 var(--sys-color-primary, #076fe5); }
    .src-row { display:flex; align-items:flex-start; gap:4px; }
    .src-row .src-handle {
      cursor: grab; user-select:none; line-height:1; padding:8px 4px; border-radius:3px;
      color: var(--ref-palette-neutral-800, #888); flex:0 0 auto;
    }
    .src-row .src-handle:active { cursor: grabbing; }
    .src-row .src-handle:hover { background: var(--ref-palette-neutral-300, #eee); color: var(--ref-palette-neutral-1000,#333); }
    .src-row .src-panel { flex:1; min-width:0; }
    .src-row .src-remove { flex:0 0 auto; }
    .src-label { display:inline-flex; align-items:center; gap:8px; min-width:0; }
    .src-label .src-badge {
      flex:0 0 auto; font-size:10px; font-weight:700; letter-spacing:.02em; text-transform:uppercase;
      padding:1px 6px; border-radius:10px;
      background: var(--ref-palette-neutral-300, #eef1f4); color: var(--ref-palette-neutral-1000, #333);
    }
    .src-label .src-badge.ds  { background:#e3f0ff; color:#0a4ea3; }
    .src-label .src-badge.geo { background:#eafaf0; color:#0a7d4b; }
    .src-label .src-name { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .src-label .src-sub  { color: var(--ref-palette-neutral-900,#6e6e6e); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .src-body { padding: 4px 2px 2px; }
    .src-toolbar { display:flex; align-items:center; justify-content:space-between; gap:6px; margin: 2px 0 8px; }
    .src-toolbar .src-count { font-size:12px; color: var(--ref-palette-neutral-900,#6e6e6e); }
    .add-row { display:flex; flex-wrap:wrap; gap:6px; margin: 2px 0 8px; }
    .add-row > .jimu-btn { flex:1 1 auto; min-width: 120px; justify-content:center; }
    .ds-picker { border:1px solid var(--ref-palette-neutral-400, #e0e0e0); border-radius:4px; padding:8px; margin-bottom:8px; background: var(--ref-palette-neutral-200, #f7f7f7); }
  `

  const popupMode = custom.popupMode || CustomPopupMode.None

  return (
    <div className='widget-setting-search-custom' css={STYLE}>
      <SettingSection title={t('mapWidget')}>
        <SettingRow>
          <MapWidgetSelector useMapWidgetIds={useMapWidgetIds} onSelect={onMapWidgetSelected} />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('transferSettingsXml')}>
        <div className='hint'>{t('moveThisExactConfigurationBetweenApps')}</div>
        <div className='btn-row'>
          <Button size='sm' type='primary' onClick={downloadXml}>{t('exportXmlFile')}</Button>
          <Button size='sm' onClick={() => { setTransferOpen(o => !o); setTransferMsg(null) }}>
            {transferOpen ? t('hide') : t('importViewXml')}
          </Button>
        </div>
        {transferMsg && <div role='status' aria-live='polite' className={`msg ${transferMsg.kind}`}>{transferMsg.text}</div>}
        {transferOpen && (
          <React.Fragment>
            <Label className='mini-label'>{t('importFromFile')}</Label>
            <div className='btn-row'>
              <Button size='sm' onClick={() => fileInputRef.current?.click()}>{t('chooseXmlFile')}</Button>
              <input ref={fileInputRef} type='file' accept='.xml,application/xml,text/xml'
                style={{ display: 'none' }} onChange={onPickFile} />
            </div>
            <Label className='mini-label'>{t('orPasteXmlAndApply')}</Label>
            <div className='xml-box'>
              <TextArea css={{ minHeight: '130px', width: '100%' }} value={importText}
                aria-label={t('pasteConfigurationXmlToImport')} placeholder={t('pasteExportedLtSearchCustomConfigGtXml')}
                onChange={(e: any) => setImportText(e.target.value)} />
            </div>
            <div className='btn-row'>
              <Button size='sm' type='primary' disabled={!importText.trim()}
                onClick={() => applyImport(importText)}>{t('applyPastedXml')}</Button>
            </div>
            <Label className='mini-label'>{t('currentConfigurationReadOnly')}</Label>
            <div className='xml-box'>
              <TextArea css={{ minHeight: '130px', width: '100%' }} aria-label={t('currentConfigurationAsXmlReadOnly')} value={currentXml} readOnly />
            </div>
          </React.Fragment>
        )}
      </SettingSection>

      <SettingSection title={t('general')}>
        <SettingRow flow='wrap' label={t('enableCustomSearch')}>
          <Switch aria-label={t('enableCustomSearch')} checked={custom.enabled !== false} onChange={e => patch({ enabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('allPlaceholder')}>
          <TextInput aria-label={t('allPlaceholder')} defaultValue={custom.allPlaceholder || ''} className='w-100'
            onAcceptValue={v => patch({ allPlaceholder: v })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('zoomScaleOnResult')}>
          <NumericInput aria-label={t('zoomScaleOnResult')} value={custom.defaultZoomScale ?? 1000} min={1}
            onChange={v => patch({ defaultZoomScale: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('popupBehavior')}>
          <Select aria-label={t('popupBehavior')} value={popupMode} onChange={e => patch({ popupMode: e.target.value as CustomPopupMode })}>
            <Option value={CustomPopupMode.None}>{t('noneZoomOnly')}</Option>
            <Option value={CustomPopupMode.InheritWebMap}>{t('useTheLayerSOwnPopup')}</Option>
            <Option value={CustomPopupMode.LayerTemplate}>{t('layerAutoFieldPopupArcade')}</Option>
            <Option value={CustomPopupMode.SpatialLookup}>{t('spatialLookupPopup')}</Option>
          </Select>
        </SettingRow>
        {popupMode === CustomPopupMode.InheritWebMap && (
          <div className='hint'>{t('eachResultOpensThePopupAlready')} <strong>{t('appDataSource')}</strong> {t('sourcesThisIsThePopupFrom')}</div>
        )}
        <SettingRow flow='wrap' label={t('initialSearchTerm')}>
          <TextInput aria-label={t('initialSearchTerm')} defaultValue={custom.initialSearchTerm || ''} className='w-100'
            onAcceptValue={v => patch({ initialSearchTerm: v })} />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('searchBehavior')}>
        <div className='hint'>{t('theseMapDirectlyToTheArcGIS')}</div>
        <SettingRow flow='wrap' label={t('autoSelectFirstResult')}>
          <Switch aria-label={t('autoSelectFirstResult')} checked={custom.autoSelect !== false} onChange={e => patch({ autoSelect: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('showAllSearchEverySource')}>
          <Switch aria-label={t('showAllSearchEverySource')} checked={custom.searchAllEnabled !== false} onChange={e => patch({ searchAllEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('showUseCurrentLocation')}>
          <Switch aria-label={t('showUseCurrentLocation')} checked={!!custom.locationEnabled} onChange={e => patch({ locationEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('drawResultGraphic')}>
          <Switch aria-label={t('drawResultGraphic')} checked={custom.resultGraphicEnabled !== false} onChange={e => patch({ resultGraphicEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('enableSuggestions')}>
          <Switch aria-label={t('enableSuggestions')} checked={custom.suggestionsEnabled !== false} onChange={e => patch({ suggestionsEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('minSuggestCharacters')}>
          <NumericInput aria-label={t('minSuggestCharacters')} value={custom.minSuggestCharacters ?? 1} min={1} max={10}
            onChange={v => patch({ minSuggestCharacters: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('maxResults')}>
          <NumericInput aria-label={t('maxResults')} value={custom.maxResults ?? 6} min={1} max={50}
            onChange={v => patch({ maxResults: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('maxSuggestions')}>
          <NumericInput aria-label={t('maxSuggestions')} value={custom.maxSuggestions ?? 6} min={1} max={50}
            onChange={v => patch({ maxSuggestions: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('enablePopupsNoneLayerModes')}>
          <Switch aria-label={t('enablePopupsNoneLayerModes')} checked={custom.popupEnabled !== false} onChange={e => patch({ popupEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('defaultSourceIndex1All')}>
          <NumericInput aria-label={t('defaultSourceIndex1All')} value={custom.activeSourceIndex ?? -1} min={-1} max={50}
            onChange={v => patch({ activeSourceIndex: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('rememberRecentSearches')}>
          <Switch aria-label={t('rememberRecentSearches')} checked={!!custom.searchHistoryEnabled}
            onChange={e => patch({ searchHistoryEnabled: e.target.checked })} />
        </SettingRow>
        {custom.searchHistoryEnabled && (
          <SettingRow flow='wrap' label={t('howManyToRemember')}>
            <NumericInput aria-label={t('howManyRecentSearchesToRemember')} value={custom.searchHistoryMax ?? 5} min={1} max={25}
              onChange={v => patch({ searchHistoryMax: v as number })} />
          </SettingRow>
        )}
        {custom.searchHistoryEnabled && (
          <div className='hint'>{t('recentSearchesAreStoredOnlyIn')}</div>
        )}
      </SettingSection>

      <SettingSection title={t('resultNavigation')}>
        <SettingRow flow='wrap' label={t('zoomToResultOnSelect')}>
          <Switch aria-label={t('zoomToResultOnSelect')} checked={custom.autoNavigate !== false} onChange={e => patch({ autoNavigate: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label={t('howTheMapMovesToA')}>
          <Select aria-label={t('howTheMapMovesToA')} value={custom.navigateMode || 'scale'}
            onChange={e => patch({ navigateMode: e.target.value as ('scale' | 'extent') })}>
            <Option value='scale'>{t('zoomToFixedScale')}</Option>
            <Option value='extent'>{t('fitToResultExtent')}</Option>
          </Select>
        </SettingRow>
        <div className='hint'>{t('fitToResultExtentFramesThe')}</div>
        <SettingRow flow='wrap' label={t('animateTheZoom')}>
          <Switch aria-label={t('animateTheZoom')} checked={!!custom.zoomAnimate} onChange={e => patch({ zoomAnimate: e.target.checked })} />
        </SettingRow>
        {custom.zoomAnimate && (
          <SettingRow flow='wrap' label={t('animationDurationMs')}>
            <NumericInput aria-label={t('animationDurationMs')} value={custom.zoomDuration ?? 500} min={0} max={10000} step={100}
              onChange={v => patch({ zoomDuration: v as number })} />
          </SettingRow>
        )}
        <SettingRow flow='wrap' label={t('openPopupOnResultSelect')}>
          <Switch aria-label={t('openPopupOnResultSelect')} checked={custom.popupOpenOnSelect !== false} onChange={e => patch({ popupOpenOnSelect: e.target.checked })} />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('placement')}>
        <SettingRow flow='wrap' label={t('whereTheSearchBoxAppears')}>
          <Select aria-label={t('whereTheSearchBoxAppears')} value={custom.placement || 'widget'} onChange={e => patch({ placement: e.target.value as ('widget' | 'map') })}>
            <Option value='widget'>{t('inTheWidgetWherePlaced')}</Option>
            <Option value='map'>{t('dockedOnTheMap')}</Option>
          </Select>
        </SettingRow>
        {custom.placement === 'map' && (
          <SettingRow flow='wrap' label={t('mapPosition')}>
            <Select aria-label={t('mapPosition')} value={custom.mapPosition || 'top-left'} onChange={e => patch({ mapPosition: e.target.value as any })}>
              <Option value='top-left'>{t('topLeft')}</Option>
              <Option value='top-right'>{t('topRight')}</Option>
              <Option value='bottom-left'>{t('bottomLeft')}</Option>
              <Option value='bottom-right'>{t('bottomRight')}</Option>
              <Option value='manual'>{t('manual')}</Option>
            </Select>
          </SettingRow>
        )}
      </SettingSection>

      <SettingSection title={t('appearance')}>
        <SettingRow flow='wrap' label={t('searchBarStyle')}>
          <Select aria-label={t('searchBarStyle')} value={custom.barStyle || 'default'}
            onChange={e => patch({ barStyle: e.target.value as any })}>
            <Option value='default'>{t('defaultNative')}</Option>
            <Option value='square'>{t('squareSharpCorners')}</Option>
            <Option value='curve'>{t('curveRoundedPill')}</Option>
            <Option value='linear'>{t('linearUnderlineOnly')}</Option>
            <Option value='floating'>{t('floatingElevatedCard')}</Option>
            <Option value='soft'>{t('softFilledPill')}</Option>
          </Select>
        </SettingRow>
        <SettingRow flow='wrap' label={t('searchBarSize')}>
          <Select aria-label={t('searchBarSize')} value={custom.barSize || 'comfortable'}
            onChange={e => patch({ barSize: e.target.value as any })}>
            <Option value='compact'>{t('searchCompact')}</Option>
            <Option value='comfortable'>{t('comfortable')}</Option>
            <Option value='large'>{t('large')}</Option>
          </Select>
        </SettingRow>
        <SettingRow flow='wrap' label={t('accentColor')}>
          <TextInput aria-label={t('accentColorHex')} className='w-100'
            defaultValue={custom.barAccent || '#003A55'}
            placeholder='#003A55'
            onAcceptValue={v => patch({ barAccent: v || undefined })} />
        </SettingRow>
        <div className='hint'>{t('styleAndSizeAreVisualThemes')}</div>
      </SettingSection>

      <SettingSection title={t('searchSources')}>
        <div className='hint'>{t('eachEntryIsOneOptionIn')}</div>
        <div className='add-row'>
          <Button size='sm' type='primary' onClick={() => addSource(CustomSourceKind.FeatureLayer)}>{t('layerSource')}</Button>
          <Button size='sm' type='primary' onClick={() => addSource(CustomSourceKind.Geocode)}>{t('geocodeSource')}</Button>
          <Button size='sm' type={showDsPicker ? 'secondary' : 'primary'} aria-expanded={showDsPicker}
            onClick={() => setShowDsPicker(v => !v)}>{t('dataSource')}</Button>
        </div>
        {showDsPicker && (
          <div className='ds-picker'>
            <div className='hint'>{t('pickOneOrMoreFeatureLayers')}</div>
            <DataSourceSelector
              types={Immutable([DataSourceTypes.FeatureLayer])}
              useDataSources={props.useDataSources}
              mustUseDataSource
              isMultiple
              onChange={onDataSourcesChange}
              widgetId={id}
            />
          </div>
        )}
        <div className='src-toolbar'>
          <span className='src-count'>{((custom.sources || []).length === 1 ? t('sourcesCountSource', { sourcesCount: (custom.sources || []).length }) : t('sourcesCountSources', { sourcesCount: (custom.sources || []).length }))}</span>
          <div className='btn-row'>
            <Button size='sm' type='tertiary' onClick={() => setAllExpanded(true)}>{t('expandAll')}</Button>
            <Button size='sm' type='tertiary' onClick={() => setAllExpanded(false)}>{t('collapseAll')}</Button>
          </div>
        </div>
        {(custom.sources || []).map((s, i) => {
          const isOpen = expandedIds.has(s.id)
          const kindLabel = s.kind === CustomSourceKind.Geocode ? t('geocode') : s.kind === CustomSourceKind.DataSource ? t('data') : t('layer')
          const badgeClass = s.kind === CustomSourceKind.Geocode ? 'geo' : s.kind === CustomSourceKind.DataSource ? 'ds' : ''
          const sub = s.kind === CustomSourceKind.DataSource ? (s.dataSourceId || '') : s.url
          return (
          <div className={`card src-card ${draggingIdx === i ? 'dragging' : ''} ${overIdx === i && draggingIdx !== i ? 'drag-over' : ''}`}
            key={s.id || i}
            draggable={armedIdx === i}
            onDragStart={() => setDraggingIdx(i)}
            onDragOver={(e: any) => { e.preventDefault(); if (overIdx !== i) setOverIdx(i) }}
            onDrop={(e: any) => { e.preventDefault(); reorderSource(draggingIdx, i); setDraggingIdx(null); setOverIdx(null); setArmedIdx(null) }}
            onDragEnd={() => { setDraggingIdx(null); setOverIdx(null); setArmedIdx(null) }}>
            <div className='src-row'>
              <span className='src-handle' aria-hidden='true' title={t('dragToReorder')}
                onMouseDown={() => setArmedIdx(i)} onMouseUp={() => setArmedIdx(null)}>⠿</span>
              <div className='src-panel'>
                <CollapsablePanel
                  level={1}
                  aria-label={t('sourceName', { name: s.name || i + 1 })}
                  isOpen={isOpen}
                  onRequestOpen={() => setExpanded(s.id, true)}
                  onRequestClose={() => setExpanded(s.id, false)}
                  label={(
                    <span className='src-label'>
                      <span className={`src-badge ${badgeClass}`}>{kindLabel}</span>
                      <span className='src-name'>{s.name || t('unnamed')}</span>
                      {!isOpen && sub ? <span className='src-sub'>- {sub}</span> : null}
                    </span>
                  )}>
                  <div className='src-body'>
            <SettingRow flow='wrap' label={t('name')}>
              <TextInput aria-label={t('name')} defaultValue={s.name} className='w-100' onAcceptValue={v => updateSource(i, { name: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label={t('placeholder')}>
              <TextInput aria-label={t('placeholder')} defaultValue={s.placeholder || ''} className='w-100' onAcceptValue={v => updateSource(i, { placeholder: v })} />
            </SettingRow>
            {s.kind === CustomSourceKind.DataSource
              ? <div className='hint'>{t('boundToAppDataSource')} <code>{s.dataSourceId}</code>{t('manageWhichDataSourcesAreAvailable')}</div>
              : <SettingRow flow='wrap' label={t('serviceUrl')}>
                  <UrlInput aria-label={t('serviceUrl')} value={s.url || ''} schemes={['https', 'http']} className='w-100'
                    onChange={(res: any) => updateSource(i, { url: (res && typeof res === 'object') ? (res.value ?? '') : (res ?? '') })} />
                </SettingRow>}
            <SettingRow flow='wrap' label={t('prefix')}>
              <TextInput aria-label={t('prefix')} defaultValue={s.prefix || ''} className='w-100' onAcceptValue={v => updateSource(i, { prefix: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label={t('suffix')}>
              <TextInput aria-label={t('suffix')} defaultValue={s.suffix || ''} className='w-100' onAcceptValue={v => updateSource(i, { suffix: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label={t('suggestionsForThisSource')}>
              <Switch aria-label={t('suggestionsForThisSource')} checked={s.suggestionsEnabled !== false} onChange={e => updateSource(i, { suggestionsEnabled: e.target.checked })} />
            </SettingRow>
            <SettingRow flow='wrap' label={t('minSuggestCharacters')}>
              <NumericInput aria-label={t('minSuggestCharacters')} value={s.minSuggestCharacters ?? 1} min={1} max={10}
                onChange={v => updateSource(i, { minSuggestCharacters: v as number })} />
            </SettingRow>
            <SettingRow flow='wrap' label={t('onlyWithinCurrentMapView')}>
              <Switch aria-label={t('onlyWithinCurrentMapView')} checked={!!s.withinViewEnabled} onChange={e => updateSource(i, { withinViewEnabled: e.target.checked })} />
            </SettingRow>
            <SettingRow flow='wrap' label={t('filterWhereClause')}>
              <TextInput aria-label={t('filterWhereClause')} defaultValue={s.filterWhere || ''} className='w-100'
                onAcceptValue={v => updateSource(i, { filterWhere: v })} />
            </SettingRow>
            {(s.kind === CustomSourceKind.FeatureLayer || s.kind === CustomSourceKind.DataSource) ? (
              <React.Fragment>
                <SettingRow flow='wrap' label={t('searchFieldsComma')}>
                  <TextInput aria-label={t('searchFieldsComma')} defaultValue={fromList(s.searchFields)} className='w-100'
                    onAcceptValue={v => updateSource(i, { searchFields: toList(v) })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('displayField')}>
                  <TextInput aria-label={t('displayField')} defaultValue={s.displayField || ''} className='w-100'
                    onAcceptValue={v => updateSource(i, { displayField: v })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('exactMatch')}>
                  <Switch aria-label={t('exactMatch')} checked={!!s.exactMatch} onChange={e => updateSource(i, { exactMatch: e.target.checked })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('zoomScale')}>
                  <NumericInput aria-label={t('zoomScale')} value={s.zoomScale ?? (custom.defaultZoomScale ?? 1000)}
                    onChange={v => updateSource(i, { zoomScale: v as number })} />
                </SettingRow>
                <Label className='mini-label'>{t('resultSymbolColorRGB')}</Label>
                {jsonField(s.resultSymbol?.color, (color) =>
                  updateSource(i, { resultSymbol: color ? { ...(s.resultSymbol || {}), color } : undefined }), 1)}
                {custom.popupMode === CustomPopupMode.LayerTemplate && (
                  <React.Fragment>
                    <Label className='mini-label'>{t('customArcadePopupForThisSource')}</Label>
                    <div className='xml-box'>
                      <TextArea css={{ minHeight: '120px', width: '100%' }}
                        aria-label={t('customArcadePopupExpressionForThis')} value={s.popupArcade || ''}
                        placeholder={t('leaveBlankToUseTheShared')}
                        onChange={(e: any) => updateSource(i, { popupArcade: e.target.value })} />
                    </div>
                  </React.Fragment>
                )}
              </React.Fragment>
            ) : (
              <React.Fragment>
                <SettingRow flow='wrap' label={t('singleLineField')}>
                  <TextInput aria-label={t('singleLineField')} defaultValue={s.singleLineFieldName || 'SingleLine'} className='w-100'
                    onAcceptValue={v => updateSource(i, { singleLineFieldName: v })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('maxSuggestions')}>
                  <NumericInput aria-label={t('maxSuggestions')} value={s.maxSuggestions ?? 10} onChange={v => updateSource(i, { maxSuggestions: v as number })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('maxResults')}>
                  <NumericInput aria-label={t('maxResults')} value={s.maxResults ?? 5} onChange={v => updateSource(i, { maxResults: v as number })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('countryCodeS')}>
                  <TextInput aria-label={t('countryCodeS')} defaultValue={s.countryCode || ''} className='w-100'
                    onAcceptValue={v => updateSource(i, { countryCode: v })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('categoriesComma')}>
                  <TextInput aria-label={t('categoriesComma')} defaultValue={fromList(s.categories)} className='w-100'
                    onAcceptValue={v => updateSource(i, { categories: toList(v) })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('searchTemplate')}>
                  <TextInput aria-label={t('searchTemplate')} defaultValue={s.searchTemplate || ''} className='w-100'
                    onAcceptValue={v => updateSource(i, { searchTemplate: v })} />
                </SettingRow>
                <SettingRow flow='wrap' label={t('locationType')}>
                  <Select aria-label={t('locationType')} value={s.locationType || ''} onChange={e => updateSource(i, { locationType: e.target.value })}>
                    <Option value=''>{t('default')}</Option>
                    <Option value='street'>{t('street')}</Option>
                    <Option value='rooftop'>{t('rooftop')}</Option>
                  </Select>
                </SettingRow>
                <Label className='mini-label'>{t('resultSymbolColorRGB')}</Label>
                {jsonField(s.resultSymbol?.color, (color) =>
                  updateSource(i, { resultSymbol: color ? { ...(s.resultSymbol || {}), color } : undefined }), 1)}
              </React.Fragment>
            )}
                </div>
                </CollapsablePanel>
              </div>
              <Button size='sm' type='tertiary' className='src-remove'
                aria-label={t('removeSearchSourceName', { name: s.name || i + 1 })} onClick={() => removeSource(i)}>{t('remove')}</Button>
            </div>
          </div>
          )
        })}
      </SettingSection>

      {popupMode !== CustomPopupMode.None && (() => {
        const po: any = custom.popupOptions || {}
        return (
        <SettingSection title={t('popupDisplay')}>
          <div className='hint'>{t('controlsTheMapPopupUsedBy')}</div>
          <SettingRow flow='wrap' label={t('dockThePopup')}>
            <Switch aria-label={t('dockThePopup')} checked={!!po.dockEnabled} onChange={e => patchPopup({ dockEnabled: e.target.checked })} />
          </SettingRow>
          {po.dockEnabled && (
            <SettingRow flow='wrap' label={t('dockPosition')}>
              <Select aria-label={t('dockPosition')} value={po.dockPosition || 'auto'} onChange={e => patchPopup({ dockPosition: e.target.value })}>
                <Option value='auto'>{t('auto')}</Option>
                <Option value='top-left'>{t('topLeft')}</Option>
                <Option value='top-center'>{t('topCenter')}</Option>
                <Option value='top-right'>{t('topRight')}</Option>
                <Option value='bottom-left'>{t('bottomLeft')}</Option>
                <Option value='bottom-center'>{t('bottomCenter')}</Option>
                <Option value='bottom-right'>{t('bottomRight')}</Option>
              </Select>
            </SettingRow>
          )}
          <SettingRow flow='wrap' label={t('autoDockOnSmallScreens')}>
            <Switch aria-label={t('autoDockOnSmallScreens')} checked={po.dockBreakpoint !== false} onChange={e => patchPopup({ dockBreakpoint: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('showDockUndockButton')}>
            <Switch aria-label={t('showDockOrUndockButton')} checked={po.dockButton !== false} onChange={e => patchPopup({ dockButton: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('collapsiblePopup')}>
            <Switch aria-label={t('collapsiblePopup')} checked={!!po.collapseEnabled} onChange={e => patchPopup({ collapseEnabled: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('highlightSelectedFeature')}>
            <Switch aria-label={t('highlightSelectedFeature')} checked={po.highlightEnabled !== false} onChange={e => patchPopup({ highlightEnabled: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('openAutomaticallyOnSelect')}>
            <Switch aria-label={t('openAutomaticallyOnSelect')} checked={po.autoOpenEnabled !== false} onChange={e => patchPopup({ autoOpenEnabled: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('maxInlineActions')}>
            <NumericInput aria-label={t('maxInlineActions')} value={po.maxInlineActions ?? 3} min={0} max={20}
              onChange={v => patchPopup({ maxInlineActions: v as number })} />
          </SettingRow>
          <Label className='mini-label'>{t('visiblePartsOfThePopup')}</Label>
          <SettingRow flow='wrap' label={t('closeButton')}>
            <Switch aria-label={t('showCloseButton')} checked={po.visibleCloseButton !== false} onChange={e => patchPopup({ visibleCloseButton: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('collapseButton')}>
            <Switch aria-label={t('showCollapseButton')} checked={po.visibleCollapseButton !== false} onChange={e => patchPopup({ visibleCollapseButton: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('featureNavigationPaging')}>
            <Switch aria-label={t('showFeatureNavigation')} checked={po.visibleFeatureNavigation !== false} onChange={e => patchPopup({ visibleFeatureNavigation: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('headingTitle')}>
            <Switch aria-label={t('showHeading')} checked={po.visibleHeading !== false} onChange={e => patchPopup({ visibleHeading: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('actionBar')}>
            <Switch aria-label={t('showActionBar')} checked={po.visibleActionBar !== false} onChange={e => patchPopup({ visibleActionBar: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('loadingSpinner')}>
            <Switch aria-label={t('showLoadingSpinner')} checked={po.visibleSpinner !== false} onChange={e => patchPopup({ visibleSpinner: e.target.checked })} />
          </SettingRow>
          <div className='hint'>{t('noteTheseConfigureTheMapS')}</div>
        </SettingSection>
        )
      })()}

      {popupMode === CustomPopupMode.LayerTemplate && (
        <SettingSection title={t('layerPopupArcade')}>
          <SettingRow flow='wrap' label={t('popupTitleTemplate')}>
            <TextInput aria-label={t('popupTitleTemplate')} defaultValue={__tc(custom.popupTitleTemplate, "location")} className='w-100'
              onAcceptValue={v => patch({ popupTitleTemplate: v })} />
          </SettingRow>
          <SettingRow flow='wrap' label={t('arcadeExpression')}>
            <Select aria-label={t('arcadeExpression')} value={custom.arcadeMode || 'generated'}
              onChange={e => patch({ arcadeMode: e.target.value as ('generated' | 'custom') })}>
              <Option value='generated'>{t('autoGenerateFromSettings')}</Option>
              <Option value='custom'>{t('customWriteMyOwn')}</Option>
            </Select>
          </SettingRow>

          {(!custom.arcadeMode || custom.arcadeMode === 'generated') && (
            <React.Fragment>
              <SettingRow flow='wrap' label={t('excludedFieldsComma')}>
                <TextInput aria-label={t('excludedFieldsComma')} defaultValue={fromList(custom.arcadeFieldsToExclude)} className='w-100'
                  onAcceptValue={v => patch({ arcadeFieldsToExclude: toList(v) })} />
              </SettingRow>
              <div className='hint'>{t('theWidgetBuildsThePopupExpression')} <strong>{t('urlFormattingRule')}</strong> {t('isTurnedIntoALinkThe')}</div>
              <Label className='mini-label'>{t('generatedArcadeExpressionReadOnlyPreview')}</Label>
              <div className='xml-box'>
                <TextArea css={{ minHeight: '180px', width: '100%' }} readOnly
                  aria-label={t('generatedArcadePopupExpressionReadOnly')}
                  value={buildArcadeExpression(custom)} />
              </div>
              <div className='btn-row'>
                <Button size='sm' onClick={() => patch({ arcadeMode: 'custom', arcadeExpression: buildArcadeExpression(custom) })}>
                  {t('editThisExpressionSwitchToCustom')}
                </Button>
              </div>
              <div className='hint'>{t('switchingToCustomCopiesThisGenerated')}</div>
            </React.Fragment>
          )}

          {custom.arcadeMode === 'custom' && (
            <React.Fragment>
              <div className='hint'>{t('youAreWritingTheArcadeExpression')}</div>
              <div className='btn-row'>
                <Button size='sm' onClick={() => patch({ arcadeExpression: buildArcadeExpression(custom) })}>
                  {t('resetFromAutoGenerated')}
                </Button>
                <Button size='sm' type='tertiary' onClick={() => patch({ arcadeMode: 'generated' })}>
                  {t('backToAutoGenerate')}
                </Button>
              </div>
              <div className='xml-box'>
                <TextArea css={{ minHeight: '220px', width: '100%' }}
                  aria-label={t('customArcadePopupExpression')} value={custom.arcadeExpression || ''}
                  placeholder={t('enterAnArcadeExpressionThatReturns')}
                  onChange={(e: any) => patch({ arcadeExpression: e.target.value })} />
              </div>
              <div className='hint'>{t('tipTheExpressionShouldReturnA')}</div>
            </React.Fragment>
          )}
        </SettingSection>
      )}

      {popupMode === CustomPopupMode.SpatialLookup && (
        <SettingSection title={t('spatialLookupRules')}>
          <SettingRow flow='wrap' label={t('popupTitle')}>
            <TextInput aria-label={t('popupTitle')} defaultValue={__tc(custom.spatialPopupTitle, "result")} className='w-100'
              onAcceptValue={v => patch({ spatialPopupTitle: v })} />
          </SettingRow>
          <div className='hint'>{t('onSelectEachRuleRunsAn')} {__t("result")}, {'{field:NAME}'}.</div>
          {(custom.lookupRules || []).map((r, i) => (
            <div className='card' key={r.id || i}>
              <div className='title'>
                <strong>{t('ruleIOutputType', { i: i + 1, outputType: r.outputType })}</strong>
                <Button size='sm' type='tertiary' aria-label={t('removeLookupRuleI', { i: i + 1 })} onClick={() => removeRule(i)}>{t('remove')}</Button>
              </div>
              <SettingRow flow='wrap' label={t('enabled')}>
                <Switch aria-label={t('enabled')} checked={r.enabled !== false} onChange={e => updateRule(i, { enabled: e.target.checked })} />
              </SettingRow>
              <SettingRow flow='wrap' label={t('layerUrl')}>
                <TextInput aria-label={t('layerUrl')} defaultValue={r.layerUrl} className='w-100' onAcceptValue={v => updateRule(i, { layerUrl: v })} />
              </SettingRow>
              <SettingRow flow='wrap' label={t('outputType')}>
                <Select aria-label={t('outputType')} value={r.outputType} onChange={e => updateRule(i, { outputType: e.target.value as LookupOutputType })}>
                  <Option value={LookupOutputType.InOutMessage}>{t('insideOutsideMessage')}</Option>
                  <Option value={LookupOutputType.FieldList}>{t('fieldList')}</Option>
                </Select>
              </SettingRow>
              {r.outputType === LookupOutputType.InOutMessage ? (
                <React.Fragment>
                  <SettingRow flow='wrap' label={t('insideMessage')}>
                    <TextArea aria-label={t('insideMessage')} css={{ minHeight: '52px', width: '100%' }} defaultValue={r.insideMessage || ''} onAcceptValue={v => updateRule(i, { insideMessage: v })} />
                  </SettingRow>
                  <SettingRow flow='wrap' label={t('outsideMessage')}>
                    <TextArea aria-label={t('outsideMessage')} css={{ minHeight: '52px', width: '100%' }} defaultValue={r.outsideMessage || ''} onAcceptValue={v => updateRule(i, { outsideMessage: v })} />
                  </SettingRow>
                  <Label className='mini-label'>{t('staticLinesOptionalJsonArrayOf')} {__t("text")})</Label>
                  {jsonField(r.staticLines, (v) => updateRule(i, { staticLines: v }), 3)}
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <SettingRow flow='wrap' label={t('sectionHeading')}>
                    <TextInput aria-label={t('sectionHeading')} defaultValue={r.sectionHeading || ''} className='w-100' onAcceptValue={v => updateRule(i, { sectionHeading: v })} />
                  </SettingRow>
                  <SettingRow flow='wrap' label={t('includeAllFields')}>
                    <Switch aria-label={t('includeAllFields')} checked={r.includeAllFields !== false} onChange={e => updateRule(i, { includeAllFields: e.target.checked })} />
                  </SettingRow>
                  {r.includeAllFields !== false ? (
                    <SettingRow flow='wrap' label={t('excludedFieldsComma')}>
                      <TextInput aria-label={t('excludedFieldsComma')} defaultValue={fromList(r.excludedFields)} className='w-100'
                        onAcceptValue={v => updateRule(i, { excludedFields: toList(v) })} />
                    </SettingRow>
                  ) : (
                    <React.Fragment>
                      <Label className='mini-label'>{t('explicitFieldsJsonArrayOf')} {__t("text2")})</Label>
                      {jsonField(r.fields, (v) => updateRule(i, { fields: v }), 3)}
                    </React.Fragment>
                  )}
                  <SettingRow flow='wrap' label={t('noResultMessage')}>
                    <TextInput aria-label={t('noResultMessage')} defaultValue={r.noResultMessage || ''} className='w-100' onAcceptValue={v => updateRule(i, { noResultMessage: v })} />
                  </SettingRow>
                </React.Fragment>
              )}
            </div>
          ))}
          <SettingRow><Button size='sm' onClick={addRule}>{t('addLookupRule')}</Button></SettingRow>
        </SettingSection>
      )}

      <SettingSection title={t('urlFormattingRules')}>
        <div className='hint'>{t('fieldValuesMatchingARuleRender')}</div>
        {(custom.urlRules || []).map((u, i) => (
          <div className='card' key={u.id || i}>
            <div className='title'>
              <strong>{u.matchType} "{u.pattern}"</strong>
              <Button size='sm' type='tertiary' aria-label={t('removeUrlRuleI', { i: i + 1 })} onClick={() => removeUrlRule(i)}>{t('remove')}</Button>
            </div>
            <SettingRow flow='wrap' label={t('matchType')}>
              <Select aria-label={t('matchType')} value={u.matchType} onChange={e => updateUrlRule(i, { matchType: e.target.value as UrlRule['matchType'] })}>
                <Option value='startsWith'>{t('startsWith')}</Option>
                <Option value='endsWith'>{t('endsWith')}</Option>
                <Option value='contains'>{t('contains')}</Option>
              </Select>
            </SettingRow>
            <SettingRow flow='wrap' label={t('pattern')}>
              <TextInput aria-label={t('pattern')} defaultValue={u.pattern} className='w-100' onAcceptValue={v => updateUrlRule(i, { pattern: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label={t('baseUrl')}>
              <TextInput aria-label={t('baseUrl')} defaultValue={u.baseUrl} className='w-100' onAcceptValue={v => updateUrlRule(i, { baseUrl: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label={t('linkText')}>
              <TextInput aria-label={t('linkText')} defaultValue={u.linkText || ''} className='w-100' onAcceptValue={v => updateUrlRule(i, { linkText: v })} />
            </SettingRow>
          </div>
        ))}
        <SettingRow><Button size='sm' onClick={addUrlRule}>{t('addUrlRule')}</Button></SettingRow>
      </SettingSection>
    </div>
  )
}

export default Setting
