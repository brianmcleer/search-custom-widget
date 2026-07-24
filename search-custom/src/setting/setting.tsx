/** @jsx jsx */
import {
  jsx, css, React, Immutable,
  DataSourceManager, DataSourceTypes, type UseDataSource
} from 'jimu-core'
import { type AllWidgetSettingProps } from 'jimu-for-builder'
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

type SettingProps = AllWidgetSettingProps<IMConfig> & {
  id: string
  useMapWidgetIds?: string[]
  useDataSources?: UseDataSource[]
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
      setTransferMsg({ kind: 'ok', text: 'Configuration exported.' })
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
      setTransferMsg({ kind: 'ok', text: 'Configuration imported and applied.' })
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
    reader.onerror = () => setTransferMsg({ kind: 'err', text: 'Could not read the selected file.' })
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
      aria-label='Advanced configuration value (JSON)'
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
      <SettingSection title='Map widget'>
        <SettingRow>
          <MapWidgetSelector useMapWidgetIds={useMapWidgetIds} onSelect={onMapWidgetSelected} />
        </SettingRow>
      </SettingSection>

      <SettingSection title='Transfer settings (XML)'>
        <div className='hint'>Move this exact configuration between apps. Export a portable XML file, then import it into another Search (Custom) widget.</div>
        <div className='btn-row'>
          <Button size='sm' type='primary' onClick={downloadXml}>Export XML file</Button>
          <Button size='sm' onClick={() => { setTransferOpen(o => !o); setTransferMsg(null) }}>
            {transferOpen ? 'Hide' : 'Import / view XML'}
          </Button>
        </div>
        {transferMsg && <div role='status' aria-live='polite' className={`msg ${transferMsg.kind}`}>{transferMsg.text}</div>}
        {transferOpen && (
          <React.Fragment>
            <Label className='mini-label'>Import from file</Label>
            <div className='btn-row'>
              <Button size='sm' onClick={() => fileInputRef.current?.click()}>Choose .xml file…</Button>
              <input ref={fileInputRef} type='file' accept='.xml,application/xml,text/xml'
                style={{ display: 'none' }} onChange={onPickFile} />
            </div>
            <Label className='mini-label'>Or paste XML and apply</Label>
            <div className='xml-box'>
              <TextArea css={{ minHeight: '130px', width: '100%' }} value={importText}
                aria-label='Paste configuration XML to import' placeholder='Paste exported &lt;searchCustomConfig&gt; XML here…'
                onChange={(e: any) => setImportText(e.target.value)} />
            </div>
            <div className='btn-row'>
              <Button size='sm' type='primary' disabled={!importText.trim()}
                onClick={() => applyImport(importText)}>Apply pasted XML</Button>
            </div>
            <Label className='mini-label'>Current configuration (read-only)</Label>
            <div className='xml-box'>
              <TextArea css={{ minHeight: '130px', width: '100%' }} aria-label='Current configuration as XML (read only)' value={currentXml} readOnly />
            </div>
          </React.Fragment>
        )}
      </SettingSection>

      <SettingSection title='General'>
        <SettingRow flow='wrap' label='Enable custom search'>
          <Switch aria-label={`Enable custom search`} checked={custom.enabled !== false} onChange={e => patch({ enabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label='"All" placeholder'>
          <TextInput aria-label={`"All" placeholder`} defaultValue={custom.allPlaceholder || ''} className='w-100'
            onAcceptValue={v => patch({ allPlaceholder: v })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Zoom scale on result'>
          <NumericInput aria-label={`Zoom scale on result`} value={custom.defaultZoomScale ?? 1000} min={1}
            onChange={v => patch({ defaultZoomScale: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Popup behavior'>
          <Select aria-label={`Popup behavior`} value={popupMode} onChange={e => patch({ popupMode: e.target.value as CustomPopupMode })}>
            <Option value={CustomPopupMode.None}>None (zoom only)</Option>
            <Option value={CustomPopupMode.InheritWebMap}>Use the layer's own popup (from web map)</Option>
            <Option value={CustomPopupMode.LayerTemplate}>Layer auto-field popup (Arcade)</Option>
            <Option value={CustomPopupMode.SpatialLookup}>Spatial lookup popup</Option>
          </Select>
        </SettingRow>
        {popupMode === CustomPopupMode.InheritWebMap && (
          <div className='hint'>Each result opens the popup already configured on its layer. For <strong>app data source</strong> sources this is the popup from the web map; for service-URL sources the SDK builds a default field popup. The widget adds no popup of its own.</div>
        )}
        <SettingRow flow='wrap' label='Initial search term'>
          <TextInput aria-label={`Initial search term`} defaultValue={custom.initialSearchTerm || ''} className='w-100'
            onAcceptValue={v => patch({ initialSearchTerm: v })} />
        </SettingRow>
      </SettingSection>

      <SettingSection title='Search behavior'>
        <div className='hint'>These map directly to the ArcGIS Search widget options.</div>
        <SettingRow flow='wrap' label='Auto-select first result'>
          <Switch aria-label={`Auto-select first result`} checked={custom.autoSelect !== false} onChange={e => patch({ autoSelect: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Show "All" (search every source)'>
          <Switch aria-label={`Show "All" (search every source)`} checked={custom.searchAllEnabled !== false} onChange={e => patch({ searchAllEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Show "Use current location"'>
          <Switch aria-label={`Show "Use current location"`} checked={!!custom.locationEnabled} onChange={e => patch({ locationEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Draw result graphic'>
          <Switch aria-label={`Draw result graphic`} checked={custom.resultGraphicEnabled !== false} onChange={e => patch({ resultGraphicEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Enable suggestions'>
          <Switch aria-label={`Enable suggestions`} checked={custom.suggestionsEnabled !== false} onChange={e => patch({ suggestionsEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Min. suggest characters'>
          <NumericInput aria-label={`Min. suggest characters`} value={custom.minSuggestCharacters ?? 1} min={1} max={10}
            onChange={v => patch({ minSuggestCharacters: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Max results'>
          <NumericInput aria-label={`Max results`} value={custom.maxResults ?? 6} min={1} max={50}
            onChange={v => patch({ maxResults: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Max suggestions'>
          <NumericInput aria-label={`Max suggestions`} value={custom.maxSuggestions ?? 6} min={1} max={50}
            onChange={v => patch({ maxSuggestions: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Enable popups (None/Layer modes)'>
          <Switch aria-label={`Enable popups (None/Layer modes)`} checked={custom.popupEnabled !== false} onChange={e => patch({ popupEnabled: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Default source index (-1 = All)'>
          <NumericInput aria-label={`Default source index (-1 = All)`} value={custom.activeSourceIndex ?? -1} min={-1} max={50}
            onChange={v => patch({ activeSourceIndex: v as number })} />
        </SettingRow>
        <SettingRow flow='wrap' label='Remember recent searches'>
          <Switch aria-label={`Remember recent searches`} checked={!!custom.searchHistoryEnabled}
            onChange={e => patch({ searchHistoryEnabled: e.target.checked })} />
        </SettingRow>
        {custom.searchHistoryEnabled && (
          <SettingRow flow='wrap' label='How many to remember'>
            <NumericInput aria-label={`How many recent searches to remember`} value={custom.searchHistoryMax ?? 5} min={1} max={25}
              onChange={v => patch({ searchHistoryMax: v as number })} />
          </SettingRow>
        )}
        {custom.searchHistoryEnabled && (
          <div className='hint'>Recent searches are stored only in this browser (local storage) and shown as quick chips under the search box. Each visitor sees their own; nothing is sent anywhere.</div>
        )}
      </SettingSection>

      <SettingSection title='Result navigation'>
        <SettingRow flow='wrap' label='Zoom to result on select'>
          <Switch aria-label={`Zoom to result on select`} checked={custom.autoNavigate !== false} onChange={e => patch({ autoNavigate: e.target.checked })} />
        </SettingRow>
        <SettingRow flow='wrap' label='How the map moves to a result'>
          <Select aria-label={`How the map moves to a result`} value={custom.navigateMode || 'scale'}
            onChange={e => patch({ navigateMode: e.target.value as ('scale' | 'extent') })}>
            <Option value='scale'>Zoom to fixed scale</Option>
            <Option value='extent'>Fit to result extent</Option>
          </Select>
        </SettingRow>
        <div className='hint'>Fit to result extent frames the whole feature (parcel, district, street). Point results still use the fixed scale.</div>
        <SettingRow flow='wrap' label='Animate the zoom'>
          <Switch aria-label={`Animate the zoom`} checked={!!custom.zoomAnimate} onChange={e => patch({ zoomAnimate: e.target.checked })} />
        </SettingRow>
        {custom.zoomAnimate && (
          <SettingRow flow='wrap' label='Animation duration (ms)'>
            <NumericInput aria-label={`Animation duration (ms)`} value={custom.zoomDuration ?? 500} min={0} max={10000} step={100}
              onChange={v => patch({ zoomDuration: v as number })} />
          </SettingRow>
        )}
        <SettingRow flow='wrap' label='Open popup on result select'>
          <Switch aria-label={`Open popup on result select`} checked={custom.popupOpenOnSelect !== false} onChange={e => patch({ popupOpenOnSelect: e.target.checked })} />
        </SettingRow>
      </SettingSection>

      <SettingSection title='Placement'>
        <SettingRow flow='wrap' label='Where the search box appears'>
          <Select aria-label={`Where the search box appears`} value={custom.placement || 'widget'} onChange={e => patch({ placement: e.target.value as ('widget' | 'map') })}>
            <Option value='widget'>In the widget (where placed)</Option>
            <Option value='map'>Docked on the map</Option>
          </Select>
        </SettingRow>
        {custom.placement === 'map' && (
          <SettingRow flow='wrap' label='Map position'>
            <Select aria-label={`Map position`} value={custom.mapPosition || 'top-left'} onChange={e => patch({ mapPosition: e.target.value as any })}>
              <Option value='top-left'>Top left</Option>
              <Option value='top-right'>Top right</Option>
              <Option value='bottom-left'>Bottom left</Option>
              <Option value='bottom-right'>Bottom right</Option>
              <Option value='manual'>Manual</Option>
            </Select>
          </SettingRow>
        )}
      </SettingSection>

      <SettingSection title='Appearance'>
        <SettingRow flow='wrap' label='Search bar style'>
          <Select aria-label={`Search bar style`} value={custom.barStyle || 'default'}
            onChange={e => patch({ barStyle: e.target.value as any })}>
            <Option value='default'>Default (native)</Option>
            <Option value='square'>Square (sharp corners)</Option>
            <Option value='curve'>Curve (rounded / pill)</Option>
            <Option value='linear'>Linear (underline only)</Option>
            <Option value='floating'>Floating (elevated card)</Option>
            <Option value='soft'>Soft (filled pill)</Option>
          </Select>
        </SettingRow>
        <SettingRow flow='wrap' label='Search bar size'>
          <Select aria-label={`Search bar size`} value={custom.barSize || 'comfortable'}
            onChange={e => patch({ barSize: e.target.value as any })}>
            <Option value='compact'>Compact</Option>
            <Option value='comfortable'>Comfortable</Option>
            <Option value='large'>Large</Option>
          </Select>
        </SettingRow>
        <SettingRow flow='wrap' label='Accent color'>
          <TextInput aria-label={`Accent color (hex)`} className='w-100'
            defaultValue={custom.barAccent || '#003A55'}
            placeholder='#003A55'
            onAcceptValue={v => patch({ barAccent: v || undefined })} />
        </SettingRow>
        <div className='hint'>Style and size are visual themes applied live to the search box; "Default" leaves the native look untouched. Accent color drives the focus ring and button hover across the non-default styles.</div>
      </SettingSection>

      <SettingSection title='Search sources'>
        <div className='hint'>Each entry is one option in the search box dropdown. Drag the ⠿ handle to reorder; click a row to expand or collapse it.</div>
        <div className='add-row'>
          <Button size='sm' type='primary' onClick={() => addSource(CustomSourceKind.FeatureLayer)}>+ Layer source</Button>
          <Button size='sm' type='primary' onClick={() => addSource(CustomSourceKind.Geocode)}>+ Geocode source</Button>
          <Button size='sm' type={showDsPicker ? 'secondary' : 'primary'} aria-expanded={showDsPicker}
            onClick={() => setShowDsPicker(v => !v)}>+ Data source</Button>
        </div>
        {showDsPicker && (
          <div className='ds-picker'>
            <div className='hint'>Pick one or more feature layers from this app's data sources; each is added as a search source below. Bindings are app-specific and are not carried by the XML export.</div>
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
          <span className='src-count'>{(custom.sources || []).length} source{(custom.sources || []).length === 1 ? '' : 's'}</span>
          <div className='btn-row'>
            <Button size='sm' type='tertiary' onClick={() => setAllExpanded(true)}>Expand all</Button>
            <Button size='sm' type='tertiary' onClick={() => setAllExpanded(false)}>Collapse all</Button>
          </div>
        </div>
        {(custom.sources || []).map((s, i) => {
          const isOpen = expandedIds.has(s.id)
          const kindLabel = s.kind === CustomSourceKind.Geocode ? 'Geocode' : s.kind === CustomSourceKind.DataSource ? 'Data' : 'Layer'
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
              <span className='src-handle' aria-hidden='true' title='Drag to reorder'
                onMouseDown={() => setArmedIdx(i)} onMouseUp={() => setArmedIdx(null)}>⠿</span>
              <div className='src-panel'>
                <CollapsablePanel
                  level={1}
                  aria-label={`Source ${s.name || i + 1}`}
                  isOpen={isOpen}
                  onRequestOpen={() => setExpanded(s.id, true)}
                  onRequestClose={() => setExpanded(s.id, false)}
                  label={(
                    <span className='src-label'>
                      <span className={`src-badge ${badgeClass}`}>{kindLabel}</span>
                      <span className='src-name'>{s.name || '(unnamed)'}</span>
                      {!isOpen && sub ? <span className='src-sub'>- {sub}</span> : null}
                    </span>
                  )}>
                  <div className='src-body'>
            <SettingRow flow='wrap' label='Name'>
              <TextInput aria-label={`Name`} defaultValue={s.name} className='w-100' onAcceptValue={v => updateSource(i, { name: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label='Placeholder'>
              <TextInput aria-label={`Placeholder`} defaultValue={s.placeholder || ''} className='w-100' onAcceptValue={v => updateSource(i, { placeholder: v })} />
            </SettingRow>
            {s.kind === CustomSourceKind.DataSource
              ? <div className='hint'>Bound to app data source <code>{s.dataSourceId}</code>. Manage which data sources are available in the "App data sources" picker below.</div>
              : <SettingRow flow='wrap' label='Service URL'>
                  <UrlInput aria-label={`Service URL`} value={s.url || ''} schemes={['https', 'http']} className='w-100'
                    onChange={(res: any) => updateSource(i, { url: (res && typeof res === 'object') ? (res.value ?? '') : (res ?? '') })} />
                </SettingRow>}
            <SettingRow flow='wrap' label='Prefix'>
              <TextInput aria-label={`Prefix`} defaultValue={s.prefix || ''} className='w-100' onAcceptValue={v => updateSource(i, { prefix: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label='Suffix'>
              <TextInput aria-label={`Suffix`} defaultValue={s.suffix || ''} className='w-100' onAcceptValue={v => updateSource(i, { suffix: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label='Suggestions for this source'>
              <Switch aria-label={`Suggestions for this source`} checked={s.suggestionsEnabled !== false} onChange={e => updateSource(i, { suggestionsEnabled: e.target.checked })} />
            </SettingRow>
            <SettingRow flow='wrap' label='Min. suggest characters'>
              <NumericInput aria-label={`Min. suggest characters`} value={s.minSuggestCharacters ?? 1} min={1} max={10}
                onChange={v => updateSource(i, { minSuggestCharacters: v as number })} />
            </SettingRow>
            <SettingRow flow='wrap' label='Only within current map view'>
              <Switch aria-label={`Only within current map view`} checked={!!s.withinViewEnabled} onChange={e => updateSource(i, { withinViewEnabled: e.target.checked })} />
            </SettingRow>
            <SettingRow flow='wrap' label='Filter (where clause)'>
              <TextInput aria-label={`Filter (where clause)`} defaultValue={s.filterWhere || ''} className='w-100'
                onAcceptValue={v => updateSource(i, { filterWhere: v })} />
            </SettingRow>
            {(s.kind === CustomSourceKind.FeatureLayer || s.kind === CustomSourceKind.DataSource) ? (
              <React.Fragment>
                <SettingRow flow='wrap' label='Search fields (comma)'>
                  <TextInput aria-label={`Search fields (comma)`} defaultValue={fromList(s.searchFields)} className='w-100'
                    onAcceptValue={v => updateSource(i, { searchFields: toList(v) })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Display field'>
                  <TextInput aria-label={`Display field`} defaultValue={s.displayField || ''} className='w-100'
                    onAcceptValue={v => updateSource(i, { displayField: v })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Exact match'>
                  <Switch aria-label={`Exact match`} checked={!!s.exactMatch} onChange={e => updateSource(i, { exactMatch: e.target.checked })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Zoom scale'>
                  <NumericInput aria-label={`Zoom scale`} value={s.zoomScale ?? (custom.defaultZoomScale ?? 1000)}
                    onChange={v => updateSource(i, { zoomScale: v as number })} />
                </SettingRow>
                <Label className='mini-label'>Result symbol color [r,g,b,a] (optional JSON)</Label>
                {jsonField(s.resultSymbol?.color, (color) =>
                  updateSource(i, { resultSymbol: color ? { ...(s.resultSymbol || {}), color } : undefined }), 1)}
                {custom.popupMode === CustomPopupMode.LayerTemplate && (
                  <React.Fragment>
                    <Label className='mini-label'>Custom Arcade popup for this source (optional; overrides the shared one)</Label>
                    <div className='xml-box'>
                      <TextArea css={{ minHeight: '120px', width: '100%' }}
                        aria-label='Custom Arcade popup expression for this source' value={s.popupArcade || ''}
                        placeholder='Leave blank to use the shared popup expression…'
                        onChange={(e: any) => updateSource(i, { popupArcade: e.target.value })} />
                    </div>
                  </React.Fragment>
                )}
              </React.Fragment>
            ) : (
              <React.Fragment>
                <SettingRow flow='wrap' label='Single-line field'>
                  <TextInput aria-label={`Single-line field`} defaultValue={s.singleLineFieldName || 'SingleLine'} className='w-100'
                    onAcceptValue={v => updateSource(i, { singleLineFieldName: v })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Max suggestions'>
                  <NumericInput aria-label={`Max suggestions`} value={s.maxSuggestions ?? 10} onChange={v => updateSource(i, { maxSuggestions: v as number })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Max results'>
                  <NumericInput aria-label={`Max results`} value={s.maxResults ?? 5} onChange={v => updateSource(i, { maxResults: v as number })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Country code(s)'>
                  <TextInput aria-label={`Country code(s)`} defaultValue={s.countryCode || ''} className='w-100'
                    onAcceptValue={v => updateSource(i, { countryCode: v })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Categories (comma)'>
                  <TextInput aria-label={`Categories (comma)`} defaultValue={fromList(s.categories)} className='w-100'
                    onAcceptValue={v => updateSource(i, { categories: toList(v) })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Search template'>
                  <TextInput aria-label={`Search template`} defaultValue={s.searchTemplate || ''} className='w-100'
                    onAcceptValue={v => updateSource(i, { searchTemplate: v })} />
                </SettingRow>
                <SettingRow flow='wrap' label='Location type'>
                  <Select aria-label={`Location type`} value={s.locationType || ''} onChange={e => updateSource(i, { locationType: e.target.value })}>
                    <Option value=''>Default</Option>
                    <Option value='street'>Street</Option>
                    <Option value='rooftop'>Rooftop</Option>
                  </Select>
                </SettingRow>
                <Label className='mini-label'>Result symbol color [r,g,b,a] (optional JSON)</Label>
                {jsonField(s.resultSymbol?.color, (color) =>
                  updateSource(i, { resultSymbol: color ? { ...(s.resultSymbol || {}), color } : undefined }), 1)}
              </React.Fragment>
            )}
                </div>
                </CollapsablePanel>
              </div>
              <Button size='sm' type='tertiary' className='src-remove'
                aria-label={`Remove search source ${s.name || i + 1}`} onClick={() => removeSource(i)}>Remove</Button>
            </div>
          </div>
          )
        })}
      </SettingSection>

      {popupMode !== CustomPopupMode.None && (() => {
        const po: any = custom.popupOptions || {}
        return (
        <SettingSection title='Popup display'>
          <div className='hint'>Controls the map popup used by search results (the shared MapView popup). Applies to whichever popup behavior is selected above.</div>
          <SettingRow flow='wrap' label='Dock the popup'>
            <Switch aria-label={`Dock the popup`} checked={!!po.dockEnabled} onChange={e => patchPopup({ dockEnabled: e.target.checked })} />
          </SettingRow>
          {po.dockEnabled && (
            <SettingRow flow='wrap' label='Dock position'>
              <Select aria-label={`Dock position`} value={po.dockPosition || 'auto'} onChange={e => patchPopup({ dockPosition: e.target.value })}>
                <Option value='auto'>Auto</Option>
                <Option value='top-left'>Top left</Option>
                <Option value='top-center'>Top center</Option>
                <Option value='top-right'>Top right</Option>
                <Option value='bottom-left'>Bottom left</Option>
                <Option value='bottom-center'>Bottom center</Option>
                <Option value='bottom-right'>Bottom right</Option>
              </Select>
            </SettingRow>
          )}
          <SettingRow flow='wrap' label='Auto-dock on small screens'>
            <Switch aria-label={`Auto-dock on small screens`} checked={po.dockBreakpoint !== false} onChange={e => patchPopup({ dockBreakpoint: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Show dock/undock button'>
            <Switch aria-label={`Show dock or undock button`} checked={po.dockButton !== false} onChange={e => patchPopup({ dockButton: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Collapsible popup'>
            <Switch aria-label={`Collapsible popup`} checked={!!po.collapseEnabled} onChange={e => patchPopup({ collapseEnabled: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Highlight selected feature'>
            <Switch aria-label={`Highlight selected feature`} checked={po.highlightEnabled !== false} onChange={e => patchPopup({ highlightEnabled: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Open automatically on select'>
            <Switch aria-label={`Open automatically on select`} checked={po.autoOpenEnabled !== false} onChange={e => patchPopup({ autoOpenEnabled: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Max inline actions'>
            <NumericInput aria-label={`Max inline actions`} value={po.maxInlineActions ?? 3} min={0} max={20}
              onChange={v => patchPopup({ maxInlineActions: v as number })} />
          </SettingRow>
          <Label className='mini-label'>Visible parts of the popup</Label>
          <SettingRow flow='wrap' label='Close button'>
            <Switch aria-label={`Show close button`} checked={po.visibleCloseButton !== false} onChange={e => patchPopup({ visibleCloseButton: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Collapse button'>
            <Switch aria-label={`Show collapse button`} checked={po.visibleCollapseButton !== false} onChange={e => patchPopup({ visibleCollapseButton: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Feature navigation (paging)'>
            <Switch aria-label={`Show feature navigation`} checked={po.visibleFeatureNavigation !== false} onChange={e => patchPopup({ visibleFeatureNavigation: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Heading (title)'>
            <Switch aria-label={`Show heading`} checked={po.visibleHeading !== false} onChange={e => patchPopup({ visibleHeading: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Action bar'>
            <Switch aria-label={`Show action bar`} checked={po.visibleActionBar !== false} onChange={e => patchPopup({ visibleActionBar: e.target.checked })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Loading spinner'>
            <Switch aria-label={`Show loading spinner`} checked={po.visibleSpinner !== false} onChange={e => patchPopup({ visibleSpinner: e.target.checked })} />
          </SettingRow>
          <div className='hint'>Note: these configure the map's shared popup, so they also affect other popups opened on the same map.</div>
        </SettingSection>
        )
      })()}

      {popupMode === CustomPopupMode.LayerTemplate && (
        <SettingSection title='Layer popup (Arcade)'>
          <SettingRow flow='wrap' label='Popup title template'>
            <TextInput aria-label={`Popup title template`} defaultValue={custom.popupTitleTemplate || '{LOCATION}'} className='w-100'
              onAcceptValue={v => patch({ popupTitleTemplate: v })} />
          </SettingRow>
          <SettingRow flow='wrap' label='Arcade expression'>
            <Select aria-label={`Arcade expression`} value={custom.arcadeMode || 'generated'}
              onChange={e => patch({ arcadeMode: e.target.value as ('generated' | 'custom') })}>
              <Option value='generated'>Auto-generate from settings</Option>
              <Option value='custom'>Custom (write my own)</Option>
            </Select>
          </SettingRow>

          {(!custom.arcadeMode || custom.arcadeMode === 'generated') && (
            <React.Fragment>
              <SettingRow flow='wrap' label='Excluded fields (comma)'>
                <TextInput aria-label={`Excluded fields (comma)`} defaultValue={fromList(custom.arcadeFieldsToExclude)} className='w-100'
                  onAcceptValue={v => patch({ arcadeFieldsToExclude: toList(v) })} />
              </SettingRow>
              <div className='hint'>The widget builds the popup expression for you from the options above: every field on the layer is listed (except the excluded ones), and any value that matches a <strong>URL formatting rule</strong> is turned into a link. The exact expression it will use is shown below.</div>
              <Label className='mini-label'>Generated Arcade expression (read-only preview)</Label>
              <div className='xml-box'>
                <TextArea css={{ minHeight: '180px', width: '100%' }} readOnly
                  aria-label='Generated Arcade popup expression (read only)'
                  value={buildArcadeExpression(custom)} />
              </div>
              <div className='btn-row'>
                <Button size='sm' onClick={() => patch({ arcadeMode: 'custom', arcadeExpression: buildArcadeExpression(custom) })}>
                  Edit this expression (switch to Custom)
                </Button>
              </div>
              <div className='hint'>Switching to Custom copies this generated expression into an editable box so you can tweak it; after that it no longer changes when you edit the options above.</div>
            </React.Fragment>
          )}

          {custom.arcadeMode === 'custom' && (
            <React.Fragment>
              <div className='hint'>You are writing the Arcade expression yourself. It runs as the popup content for every feature-layer source and is stored in this widget's settings (and the XML export). Use the button to reset it from the auto-generated version at any time.</div>
              <div className='btn-row'>
                <Button size='sm' onClick={() => patch({ arcadeExpression: buildArcadeExpression(custom) })}>
                  Reset from auto-generated
                </Button>
                <Button size='sm' type='tertiary' onClick={() => patch({ arcadeMode: 'generated' })}>
                  Back to auto-generate
                </Button>
              </div>
              <div className='xml-box'>
                <TextArea css={{ minHeight: '220px', width: '100%' }}
                  aria-label='Custom Arcade popup expression' value={custom.arcadeExpression || ''}
                  placeholder='Enter an Arcade expression that returns the popup HTML…'
                  onChange={(e: any) => patch({ arcadeExpression: e.target.value })} />
              </div>
              <div className='hint'>Tip: the expression should return a string (HTML allowed). Use $feature to read attributes.</div>
            </React.Fragment>
          )}
        </SettingSection>
      )}

      {popupMode === CustomPopupMode.SpatialLookup && (
        <SettingSection title='Spatial lookup rules'>
          <SettingRow flow='wrap' label='Popup title'>
            <TextInput aria-label={`Popup title`} defaultValue={custom.spatialPopupTitle || '{result}'} className='w-100'
              onAcceptValue={v => patch({ spatialPopupTitle: v })} />
          </SettingRow>
          <div className='hint'>On select, each rule runs an intersect query and appends its HTML to the popup. Tokens: {'{result}'}, {'{field:NAME}'}.</div>
          {(custom.lookupRules || []).map((r, i) => (
            <div className='card' key={r.id || i}>
              <div className='title'>
                <strong>Rule {i + 1}: {r.outputType}</strong>
                <Button size='sm' type='tertiary' aria-label={`Remove lookup rule ${i + 1}`} onClick={() => removeRule(i)}>Remove</Button>
              </div>
              <SettingRow flow='wrap' label='Enabled'>
                <Switch aria-label={`Enabled`} checked={r.enabled !== false} onChange={e => updateRule(i, { enabled: e.target.checked })} />
              </SettingRow>
              <SettingRow flow='wrap' label='Layer URL'>
                <TextInput aria-label={`Layer URL`} defaultValue={r.layerUrl} className='w-100' onAcceptValue={v => updateRule(i, { layerUrl: v })} />
              </SettingRow>
              <SettingRow flow='wrap' label='Output type'>
                <Select aria-label={`Output type`} value={r.outputType} onChange={e => updateRule(i, { outputType: e.target.value as LookupOutputType })}>
                  <Option value={LookupOutputType.InOutMessage}>Inside/Outside message</Option>
                  <Option value={LookupOutputType.FieldList}>Field list</Option>
                </Select>
              </SettingRow>
              {r.outputType === LookupOutputType.InOutMessage ? (
                <React.Fragment>
                  <SettingRow flow='wrap' label='Inside message'>
                    <TextArea aria-label={`Inside message`} css={{ minHeight: '52px', width: '100%' }} defaultValue={r.insideMessage || ''} onAcceptValue={v => updateRule(i, { insideMessage: v })} />
                  </SettingRow>
                  <SettingRow flow='wrap' label='Outside message'>
                    <TextArea aria-label={`Outside message`} css={{ minHeight: '52px', width: '100%' }} defaultValue={r.outsideMessage || ''} onAcceptValue={v => updateRule(i, { outsideMessage: v })} />
                  </SettingRow>
                  <Label className='mini-label'>Static lines (optional JSON array of {'{label,value,isLink?,href?}'})</Label>
                  {jsonField(r.staticLines, (v) => updateRule(i, { staticLines: v }), 3)}
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <SettingRow flow='wrap' label='Section heading'>
                    <TextInput aria-label={`Section heading`} defaultValue={r.sectionHeading || ''} className='w-100' onAcceptValue={v => updateRule(i, { sectionHeading: v })} />
                  </SettingRow>
                  <SettingRow flow='wrap' label='Include all fields'>
                    <Switch aria-label={`Include all fields`} checked={r.includeAllFields !== false} onChange={e => updateRule(i, { includeAllFields: e.target.checked })} />
                  </SettingRow>
                  {r.includeAllFields !== false ? (
                    <SettingRow flow='wrap' label='Excluded fields (comma)'>
                      <TextInput aria-label={`Excluded fields (comma)`} defaultValue={fromList(r.excludedFields)} className='w-100'
                        onAcceptValue={v => updateRule(i, { excludedFields: toList(v) })} />
                    </SettingRow>
                  ) : (
                    <React.Fragment>
                      <Label className='mini-label'>Explicit fields (JSON array of {'{field,label?}'})</Label>
                      {jsonField(r.fields, (v) => updateRule(i, { fields: v }), 3)}
                    </React.Fragment>
                  )}
                  <SettingRow flow='wrap' label='No-result message'>
                    <TextInput aria-label={`No-result message`} defaultValue={r.noResultMessage || ''} className='w-100' onAcceptValue={v => updateRule(i, { noResultMessage: v })} />
                  </SettingRow>
                </React.Fragment>
              )}
            </div>
          ))}
          <SettingRow><Button size='sm' onClick={addRule}>+ Add lookup rule</Button></SettingRow>
        </SettingSection>
      )}

      <SettingSection title='URL formatting rules'>
        <div className='hint'>Field values matching a rule render as links. Empty "base URL" uses the value as-is.</div>
        {(custom.urlRules || []).map((u, i) => (
          <div className='card' key={u.id || i}>
            <div className='title'>
              <strong>{u.matchType} "{u.pattern}"</strong>
              <Button size='sm' type='tertiary' aria-label={`Remove URL rule ${i + 1}`} onClick={() => removeUrlRule(i)}>Remove</Button>
            </div>
            <SettingRow flow='wrap' label='Match type'>
              <Select aria-label={`Match type`} value={u.matchType} onChange={e => updateUrlRule(i, { matchType: e.target.value as UrlRule['matchType'] })}>
                <Option value='startsWith'>starts with</Option>
                <Option value='endsWith'>ends with</Option>
                <Option value='contains'>contains</Option>
              </Select>
            </SettingRow>
            <SettingRow flow='wrap' label='Pattern'>
              <TextInput aria-label={`Pattern`} defaultValue={u.pattern} className='w-100' onAcceptValue={v => updateUrlRule(i, { pattern: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label='Base URL'>
              <TextInput aria-label={`Base URL`} defaultValue={u.baseUrl} className='w-100' onAcceptValue={v => updateUrlRule(i, { baseUrl: v })} />
            </SettingRow>
            <SettingRow flow='wrap' label='Link text'>
              <TextInput aria-label={`Link text`} defaultValue={u.linkText || ''} className='w-100' onAcceptValue={v => updateUrlRule(i, { linkText: v })} />
            </SettingRow>
          </div>
        ))}
        <SettingRow><Button size='sm' onClick={addUrlRule}>+ Add URL rule</Button></SettingRow>
      </SettingSection>
    </div>
  )
}

export default Setting
