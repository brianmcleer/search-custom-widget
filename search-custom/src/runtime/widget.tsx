/** @jsx jsx */
import { React, jsx, type AllWidgetProps, DataSourceManager, DataSourceComponent } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import Search from '@arcgis/core/widgets/Search'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import Color from '@arcgis/core/Color'
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils'
import {
    type IMConfig,
    CustomPopupMode,
    CustomSourceKind,
    type CustomSearchConfig,
    type CustomSearchSource
} from '../config'
import {
    buildArcadeExpression,
    buildLookupRuleHtml,
    applyTokens
} from './custom-search'
import './widget.scss'

const { useEffect, useRef, useState } = React

type WidgetProps = AllWidgetProps<IMConfig> & {
    id: string
    useMapWidgetIds?: string[]
    useDataSources?: any[]
}

const Widget = (props: WidgetProps) => {
    const { useMapWidgetIds, config } = props
    const searchWidgetRef = useRef<Search | null>(null)
    const searchContainerRef = useRef<HTMLDivElement | null>(null)
    const [jimuMapView, setJimuMapView] = useState<JimuMapView | null>(null)
    const [statusMsg, setStatusMsg] = useState<string>('Initializing…')
    const [history, setHistory] = useState<string[]>([])
    const [showHistory, setShowHistory] = useState(false)
    const [dsReadyTick, setDsReadyTick] = useState(0)
    const historyRef = useRef<string[]>([])
    const panelRef = useRef<HTMLDivElement | null>(null)
    const focusedRef = useRef<boolean>(false)
    const termWatchRef = useRef<any>(null)
    const suppressUntilRef = useRef<number>(0)
    // Live navigation + history options read by the Search handlers at call time,
    // so changing them never forces a destroy/rebuild of the widget.
    const navRef = useRef<any>({})
    const histCfgRef = useRef<any>({})

    // Plain JS copy of the immutable config block.
    const custom: CustomSearchConfig | undefined = config?.customConfig
        ? (config.customConfig as any).asMutable
            ? (config.customConfig as any).asMutable({ deep: true })
            : (config.customConfig as any)
        : undefined

    // Keep the live option refs current on every render (cheap object assigns).
    navRef.current = {
        autoNavigate: custom?.autoNavigate !== false,
        fitToExtent: custom?.navigateMode === 'extent',
        zoomScale: custom?.defaultZoomScale ?? 1000,
        zoomGoToOpts: { animate: custom?.zoomAnimate === true, duration: custom?.zoomDuration },
        openPopupOnSelect: custom?.popupOpenOnSelect !== false
    }
    histCfgRef.current = {
        enabled: !!custom?.searchHistoryEnabled,
        max: Math.max(1, custom?.searchHistoryMax ?? 5)
    }

    // --- Recent-search history (browser localStorage, per widget instance) ---
    const storageKey = `search-custom-history:${props.id}`
    const loadHistory = (): string[] => {
        try { const r = window.localStorage.getItem(storageKey); return r ? JSON.parse(r) : [] } catch { return [] }
    }
    const saveHistory = (arr: string[]) => {
        try { window.localStorage.setItem(storageKey, JSON.stringify(arr)) } catch { /* storage unavailable */ }
    }
    const pushHistory = (term: string) => {
        const clean = (term || '').trim()
        if (!clean) return
        setHistory(prev => {
            const next = [clean, ...prev.filter(t => t !== clean)].slice(0, histCfgRef.current.max)
            saveHistory(next)
            return next
        })
    }
    const clearHistory = () => {
        setHistory([])
        try { window.localStorage.removeItem(storageKey) } catch { /* noop */ }
    }
    const runHistorySearch = (term: string) => {
        const w = searchWidgetRef.current as any
        if (!w) return
        try { w.searchTerm = term; w.search(term) } catch { /* noop */ }
    }
    const selectHistory = (term: string) => {
        setShowHistory(false)
        runHistorySearch(term)
    }

    // Whether the search box is currently empty. Reads the Search widget's own
    // searchTerm rather than the DOM input, because the JS API 5.0 Search renders
    // its input inside a Calcite shadow DOM that querySelector cannot see.
    const isBoxEmpty = (): boolean => {
        const term = (searchWidgetRef.current as any)?.searchTerm
        return !term || !String(term).length
    }
    const openHistoryIfEligible = () => {
        // Don't reopen right after a term change (clearing via ✕, typing, or
        // selecting), so those actions can never pop the dropdown back up.
        if (Date.now() < suppressUntilRef.current) return
        if (histCfgRef.current.enabled && historyRef.current.length > 0 && isBoxEmpty()) {
            setShowHistory(true)
        }
    }

    // Keep a ref copy of history so DOM focus listeners (attached once) see the
    // current list without being re-bound on every change.
    historyRef.current = history

    // Load any saved history once on mount.
    useEffect(() => {
        setHistory(loadHistory())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey])

    // Show recent searches ONLY when the user focuses the search text box (and it
    // is empty); hide on any click outside the box, on tab-away, and on any change
    // to the search term (handled by the searchTerm watch in the attach effect).
    useEffect(() => {
        const c = searchContainerRef.current
        if (!c) return
        const onFocusIn = () => { focusedRef.current = true; openHistoryIfEligible() }
        const onFocusOut = (e: any) => {
            // Keep open if focus is moving into the dropdown itself (keyboard nav).
            const next = e?.relatedTarget as Node | null
            if (next && panelRef.current && panelRef.current.contains(next)) return
            focusedRef.current = false
            setShowHistory(false)
        }
        // Click-outside-to-close: any pointer press that is neither in the search
        // box nor in the dropdown collapses it. Keeps the dropdown non-invasive.
        const onDocPointerDown = (ev: any) => {
            const t = ev?.target as Node | null
            if (!t) return
            if (c.contains(t)) return
            if (panelRef.current && panelRef.current.contains(t)) return
            setShowHistory(false)
        }
        c.addEventListener('focusin', onFocusIn)
        c.addEventListener('focusout', onFocusOut)
        document.addEventListener('pointerdown', onDocPointerDown, true)
        return () => {
            c.removeEventListener('focusin', onFocusIn)
            c.removeEventListener('focusout', onFocusOut)
            document.removeEventListener('pointerdown', onDocPointerDown, true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Parts of the config that require destroying and rebuilding the Search
    // widget. Simple toggles (incl. all of the Result-navigation options and
    // search history) are applied live below WITHOUT a rebuild.
    const structuralKey = JSON.stringify({
        enabled: custom?.enabled,
        popupMode: custom?.popupMode,
        popupOptions: custom?.popupOptions,
        sources: custom?.sources,
        urlRules: custom?.urlRules,
        lookupRules: custom?.lookupRules,
        popupTitleTemplate: custom?.popupTitleTemplate,
        arcadeFieldsToExclude: custom?.arcadeFieldsToExclude,
        arcadeMode: custom?.arcadeMode,
        arcadeExpression: custom?.arcadeExpression,
        spatialPopupTitle: custom?.spatialPopupTitle,
        includeDefaultSources: custom?.includeDefaultSources,
        defaultZoomScale: custom?.defaultZoomScale,
        placement: custom?.placement,
        mapPosition: custom?.mapPosition
    })

    useEffect(() => {
        const hasMap = !!(useMapWidgetIds && useMapWidgetIds.length)
        const view = jimuMapView?.view

        if (!searchContainerRef.current) { setStatusMsg(''); return }
        if (!hasMap) { setStatusMsg('No map linked. Open this widget\u2019s settings and choose your map under \u201CMap widget\u201D.'); return }
        if (!custom || custom.enabled === false) { setStatusMsg('Custom search is turned off in settings.'); return }
        if (!view) { setStatusMsg(''); return }

        setStatusMsg('')

        const dockOnMap = (custom.placement || 'widget') === 'map'

        // Defensive: clear any prior instance so we never stack two widgets.
        if (searchWidgetRef.current) {
            try { if (dockOnMap) view.ui.remove(searchWidgetRef.current) } catch { /* noop */ }
            try { searchWidgetRef.current.destroy() } catch { /* noop */ }
            searchWidgetRef.current = null
        }
        if (searchContainerRef.current) {
            try { searchContainerRef.current.innerHTML = '' } catch { /* noop */ }
        }

        let cancelled = false

        const attach = () => {
            if (cancelled || !searchContainerRef.current) return
            try {

                const popupMode = custom.popupMode || CustomPopupMode.None
                const urlRules = custom.urlRules || []

                // Apply developer-configured MapView popup display options (docking,
                // collapse, visible elements, highlight, navigation, inline actions).
                // These configure the shared view.popup, so they affect popups opened by
                // the search results.
                if (popupMode !== CustomPopupMode.None && view.popup && custom.popupOptions) {
                    try {
                        const po: any = custom.popupOptions
                        const popup: any = view.popup
                        if (po.dockEnabled != null) popup.dockEnabled = po.dockEnabled
                        popup.dockOptions = {
                            ...(popup.dockOptions || {}),
                            buttonEnabled: po.dockButton !== false,
                            position: po.dockPosition || 'auto',
                            breakpoint: po.dockBreakpoint !== false
                        }
                        if (po.collapseEnabled != null) popup.collapseEnabled = po.collapseEnabled
                        if (po.highlightEnabled != null) popup.highlightEnabled = po.highlightEnabled
                        if (po.autoOpenEnabled != null) popup.autoOpenEnabled = po.autoOpenEnabled
                        if (po.maxInlineActions != null) popup.maxInlineActions = po.maxInlineActions
                        popup.visibleElements = {
                            ...(popup.visibleElements || {}),
                            closeButton: po.visibleCloseButton !== false,
                            collapseButton: po.visibleCollapseButton !== false,
                            featureNavigation: po.visibleFeatureNavigation !== false,
                            heading: po.visibleHeading !== false,
                            actionBar: po.visibleActionBar !== false,
                            spinner: po.visibleSpinner !== false
                        }
                    } catch { /* popup options are best-effort */ }
                }

                let sharedExpression = ''
                try {
                    sharedExpression = (custom.arcadeMode === 'custom' && custom.arcadeExpression && custom.arcadeExpression.trim())
                        ? custom.arcadeExpression
                        : buildArcadeExpression(custom)
                } catch (e) {
                    console.error('[Search Custom] Could not build the Arcade popup expression; using a minimal fallback.', e)
                    sharedExpression = '"See attributes."'
                }

                const makeTemplate = (expression: string) => ({
                    title: custom.popupTitleTemplate || '{LOCATION}',
                    content: [{ type: 'expression', expressionInfo: { name: 'arcadePopup', expression } }]
                })

                // Build a feature layer for a source, honoring an optional per-source Arcade.
                const inheritWebMap = popupMode === CustomPopupMode.InheritWebMap
                const layerFromUrl = (url: string, template: any): FeatureLayer => new FeatureLayer({
                    url,
                    outFields: ['*'],
                    popupEnabled: !!template || inheritWebMap,
                    // Service-URL layers have no web map popup to inherit, so let the SDK
                    // auto-build a field popup when inheriting.
                    ...(inheritWebMap && !template ? { defaultPopupTemplateEnabled: true } : {}),
                    ...(template ? { popupTemplate: template } : {})
                })

                const buildLayerForSource = (s: CustomSearchSource): FeatureLayer | null => {
                    let template: any = null
                    if (popupMode === CustomPopupMode.LayerTemplate) {
                        template = (s.popupArcade && s.popupArcade.trim())
                            ? makeTemplate(s.popupArcade)
                            : makeTemplate(sharedExpression)
                    }
                    // EB data source: resolve to the underlying layer via DataSourceManager.
                    if (s.kind === CustomSourceKind.DataSource) {
                        try {
                            const ds: any = s.dataSourceId
                                ? DataSourceManager.getInstance().getDataSource(s.dataSourceId)
                                : null
                            if (!ds) return null
                            // Inherit mode: use the web map's own layer instance so its
                            // configured popupTemplate comes along untouched.
                            if (inheritWebMap && ds.layer) {
                                ds.layer.popupEnabled = true
                                return ds.layer
                            }
                            const url: string | undefined = ds.url || ds.getDataSourceJson?.()?.url
                            if (url) return layerFromUrl(url, template)
                            if (ds.layer) {
                                const lyr = ds.layer
                                if (template) { lyr.popupTemplate = template; lyr.popupEnabled = true }
                                else if (inheritWebMap) { lyr.popupEnabled = true }
                                return lyr
                            }
                            return null
                        } catch { return null }
                    }
                    return layerFromUrl(s.url, template)
                }

                const symbolFrom = (rs: any) => ({
                    type: 'simple-marker',
                    color: new Color(rs.color || [255, 0, 0, 0.6]),
                    size: rs.size ?? 8
                })

                const buildSource = (s: CustomSearchSource): any => {
                    const shared: any = { name: s.name, placeholder: s.placeholder }
                    if (s.prefix) shared.prefix = s.prefix
                    if (s.suffix) shared.suffix = s.suffix
                    if (s.minSuggestCharacters != null) shared.minSuggestCharacters = s.minSuggestCharacters
                    if (s.suggestionsEnabled != null) shared.suggestionsEnabled = s.suggestionsEnabled
                    if (s.withinViewEnabled != null) shared.withinViewEnabled = s.withinViewEnabled
                    if (s.filterWhere) shared.filter = { where: s.filterWhere }
                    if (s.resultSymbol) shared.resultSymbol = symbolFrom(s.resultSymbol)

                    if (s.kind === CustomSourceKind.Geocode) {
                        const src: any = {
                            ...shared,
                            url: s.url,
                            singleLineFieldName: s.singleLineFieldName || 'SingleLine',
                            maxSuggestions: s.maxSuggestions ?? 10,
                            maxResults: s.maxResults ?? 5,
                            suggest: s.suggest ?? true,
                            outFields: s.outFields || ['*']
                        }
                        if (s.countryCode) src.countryCode = s.countryCode
                        if (s.categories && s.categories.length) src.categories = s.categories
                        if (s.searchTemplate) src.searchTemplate = s.searchTemplate
                        if (s.locationType) src.locationType = s.locationType
                        return src
                    }
                    const layer = buildLayerForSource(s)
                    if (!layer) return null
                    return {
                        ...shared,
                        layer,
                        searchFields: s.searchFields || [],
                        displayField: s.displayField || (s.searchFields && s.searchFields[0]),
                        exactMatch: s.exactMatch ?? false,
                        outFields: s.outFields || ['*'],
                        zoomScale: s.zoomScale ?? (custom.defaultZoomScale ?? 1000)
                    }
                }

                const sources = (custom.sources || []).map(buildSource).filter(Boolean)
                const useDefaultSources = sources.length === 0 ? true : (custom.includeDefaultSources ?? false)

                const searchOptions: any = {
                    view,
                    includeDefaultSources: useDefaultSources,
                    sources
                }
                if (!dockOnMap) searchOptions.container = searchContainerRef.current as HTMLDivElement
                if (custom.allPlaceholder) searchOptions.allPlaceholder = custom.allPlaceholder
                if (custom.autoSelect != null) searchOptions.autoSelect = custom.autoSelect
                if (custom.searchAllEnabled != null) searchOptions.searchAllEnabled = custom.searchAllEnabled
                if (custom.resultGraphicEnabled != null) searchOptions.resultGraphicEnabled = custom.resultGraphicEnabled
                if (custom.locationEnabled != null) searchOptions.locationEnabled = custom.locationEnabled
                if (custom.suggestionsEnabled != null) searchOptions.suggestionsEnabled = custom.suggestionsEnabled
                if (custom.minSuggestCharacters != null) searchOptions.minSuggestCharacters = custom.minSuggestCharacters
                if (custom.maxResults != null) searchOptions.maxResults = custom.maxResults
                if (custom.maxSuggestions != null) searchOptions.maxSuggestions = custom.maxSuggestions
                if (custom.initialSearchTerm) searchOptions.searchTerm = custom.initialSearchTerm
                if (custom.activeSourceIndex != null) {
                    // activeSourceIndex is applied AFTER construction (below) and live,
                    // never in the constructor: post-construction assignment is more
                    // reliable for -1 (All sources), and keeping it out of the rebuild key
                    // means changing it never tears the Search down.
                }
                if (custom.autoNavigate != null) searchOptions.autoNavigate = custom.autoNavigate

                if (popupMode === CustomPopupMode.SpatialLookup) {
                    searchOptions.popupEnabled = true
                } else {
                    searchOptions.popupEnabled = inheritWebMap ? true : (custom.popupEnabled !== false)
                    searchOptions.goToOverride = (v: any, goToParams: any) => {
                        const n = navRef.current
                        if (!n.autoNavigate) return
                        // In fit-to-extent mode let the search-complete handler do the work
                        // (it has the result geometry); just suppress the default jump here.
                        if (n.fitToExtent) return
                        v.goTo(goToParams.target, n.zoomGoToOpts)
                    }
                }

                let searchWidget: Search
                try {
                    searchWidget = new Search(searchOptions)
                } catch (err) {
                    console.error('[Search Custom] Failed to create the Search widget:', err)
                    setStatusMsg('Search could not be created. See the browser console.')
                    return
                }

                if (dockOnMap) {
                    try { view.ui.add(searchWidget, custom.mapPosition || 'top-left') } catch (e) { console.error('[Search Custom] view.ui.add failed:', e) }
                }

                // Set the active source AFTER construction. -1 selects "All" (and is what
                // makes the "All" placeholder show); 0..maxIdx selects a specific source;
                // an out-of-range positive index (e.g. from a legacy import) is ignored so
                // it can never blank the box.
                try {
                    if (custom.activeSourceIndex != null) {
                        const maxIdx = sources.length - 1
                        const i = custom.activeSourceIndex as number
                        if (i === -1 || (i >= 0 && i <= maxIdx)) searchWidget.activeSourceIndex = i
                    }
                } catch (e) { console.error('[Search Custom] Could not set active source:', e) }

                // LayerTemplate / None: zoom to the matched result.
                if (popupMode !== CustomPopupMode.SpatialLookup) {
                    searchWidget.on('search-complete', (event: any) => {
                        const n = navRef.current
                        if (!n.autoNavigate) return
                        const firstResult = event?.results?.[0]?.results?.[0]
                        const feature = firstResult?.feature
                        const geom: any = feature?.geometry
                        if (!geom) return

                        // Fit-to-extent mode: zoom to the result's full extent (parcels,
                        // districts, streets), with a small margin. Points have no usable
                        // extent, so they fall back to the fixed-scale path below.
                        if (n.fitToExtent) {
                            const ext = geom.extent || firstResult?.extent
                            if (ext && typeof ext.expand === 'function') {
                                view.goTo(ext.expand(1.1), n.zoomGoToOpts)
                                return
                            }
                            if (ext) { view.goTo(ext, n.zoomGoToOpts); return }
                        }

                        // Fixed-scale (default): go to the location at the source's scale.
                        let loc: any = geom
                        if (loc.type !== 'point') {
                            if (loc.centroid) loc = loc.centroid
                            else if (loc.extent?.center) loc = loc.extent.center
                            else return
                        }
                        view.goTo({ target: loc, scale: n.zoomScale }, n.zoomGoToOpts)
                    })
                }

                // Record selected results into recent-search history (any popup mode).
                // Always attached; gated live by the history toggle so flipping it on/off
                // never rebuilds the widget.
                searchWidget.on('select-result', (event: any) => {
                    if (!histCfgRef.current.enabled) return
                    const name = event?.result?.name
                    if (name) pushHistory(name)
                })

                // SpatialLookup: run intersect rules and build a popup.
                if (popupMode === CustomPopupMode.SpatialLookup) {
                    const rules = (custom.lookupRules || []).filter(r => r.enabled !== false)
                    const ruleLayers: Record<string, FeatureLayer> = {}
                    for (const r of rules) {
                        if (!ruleLayers[r.layerUrl]) ruleLayers[r.layerUrl] = new FeatureLayer({ url: r.layerUrl, outFields: ['*'] })
                    }
                    searchWidget.on('select-result', async (event: any) => {
                        const resultName = event?.result?.name || 'Search result'
                        const feature = event?.result?.feature
                        const location = feature?.geometry
                        if (!location || location.type !== 'point') return
                        const sections: string[] = []
                        for (const rule of rules) {
                            const layer = ruleLayers[rule.layerUrl]
                            try {
                                await layer.load()
                                const q = layer.createQuery()
                                q.geometry = location
                                q.spatialRelationship = (rule.spatialRelationship as any) || 'intersects'
                                q.returnGeometry = false
                                q.outFields = ['*']
                                const res = await layer.queryFeatures(q)
                                const matched = res.features?.[0]
                                const attrs = matched ? matched.attributes : null
                                const html = buildLookupRuleHtml(rule, resultName, attrs, layer.fields as any, urlRules)
                                if (html) sections.push(html)
                            } catch (err) {
                                console.error('[Search Custom] Lookup rule query failed:', rule.layerUrl, err)
                            }
                        }
                        if (!navRef.current.openPopupOnSelect) return
                        const content = `<div class="popup-details" style="padding:10px;">${sections.join('<hr/>')}</div>`
                        view.popup.open({ title: applyTokens(custom.spatialPopupTitle || '{result}', resultName, {}), content, location })
                    })
                }

                searchWidgetRef.current = searchWidget

                // Collapse recent-search history on ANY change to the search term - both
                // typing and clearing via the ✕ button - and briefly suppress reopening so
                // a focus bounce from those actions can't pop it back. History only
                // reopens on a genuine focus of the empty box.
                try { termWatchRef.current?.remove?.() } catch { /* noop */ }
                termWatchRef.current = reactiveUtils.watch(
                    () => (searchWidgetRef.current as any)?.searchTerm,
                    () => { setShowHistory(false); suppressUntilRef.current = Date.now() + 500 }
                )

                setStatusMsg('')
            } catch (err) {
                console.error('[Search Custom] Build failed; showing a message instead of a blank widget.', err)
                setStatusMsg('This search configuration could not be built. If it was just imported, re-check the sources and popup settings in this widget.')
            }
        }

        // Attach synchronously when the view is ready (e.g. rebuild after a settings
        // change) so the search box never disappears between renders.
        if ((view as any).ready === true) {
            attach()
        } else if (typeof (view as any).when === 'function') {
            ; (view as any).when(attach, (e: any) => {
                console.error('[Search Custom] view.when() failed:', e)
                setStatusMsg('The map view did not finish loading.')
            })
        } else {
            attach()
        }

        return () => {
            cancelled = true
            try { termWatchRef.current?.remove?.() } catch { /* noop */ }
            termWatchRef.current = null
            if (searchWidgetRef.current) {
                try { if (dockOnMap) view.ui.remove(searchWidgetRef.current) } catch { /* noop */ }
                try { searchWidgetRef.current.destroy() } catch { /* noop */ }
                searchWidgetRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jimuMapView, structuralKey, useMapWidgetIds, dsReadyTick])

    // Apply simple, live-updatable options without a rebuild.
    useEffect(() => {
        const w = searchWidgetRef.current as any
        if (!w || !custom) return
        if (custom.autoSelect != null) w.autoSelect = custom.autoSelect
        if (custom.searchAllEnabled != null) w.searchAllEnabled = custom.searchAllEnabled
        if (custom.resultGraphicEnabled != null) w.resultGraphicEnabled = custom.resultGraphicEnabled
        if (custom.locationEnabled != null) w.locationEnabled = custom.locationEnabled
        if (custom.suggestionsEnabled != null) w.suggestionsEnabled = custom.suggestionsEnabled
        if (custom.minSuggestCharacters != null) w.minSuggestCharacters = custom.minSuggestCharacters
        if (custom.maxResults != null) w.maxResults = custom.maxResults
        if (custom.maxSuggestions != null) w.maxSuggestions = custom.maxSuggestions
        if (custom.popupEnabled != null && custom.popupMode !== CustomPopupMode.SpatialLookup &&
            custom.popupMode !== CustomPopupMode.InheritWebMap) {
            w.popupEnabled = custom.popupEnabled
        }
        if (custom.autoNavigate != null) w.autoNavigate = custom.autoNavigate
        // Placeholder and active source are volatile, display-only settings; apply
        // them live so editing them never rebuilds (and blanks) the Search.
        if (custom.allPlaceholder != null) w.allPlaceholder = custom.allPlaceholder
        if (custom.activeSourceIndex != null) {
            try {
                const count = (w.allSources?.length ?? w.sources?.length ?? 0) as number
                const i = custom.activeSourceIndex as number
                if (i === -1 || (i >= 0 && i <= count - 1)) w.activeSourceIndex = i
            } catch { /* noop */ }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        custom?.autoSelect, custom?.searchAllEnabled, custom?.resultGraphicEnabled,
        custom?.locationEnabled, custom?.suggestionsEnabled, custom?.minSuggestCharacters,
        custom?.maxResults, custom?.maxSuggestions, custom?.popupEnabled, custom?.autoNavigate,
        custom?.allPlaceholder, custom?.activeSourceIndex
    ])

    const handleActiveViewChange = (view: JimuMapView): void => {
        setJimuMapView(view)
    }

    return (
        <div className={`widget-search jimu-widget search-styled bar-${custom?.barStyle || 'default'} size-${custom?.barSize || 'comfortable'}`}
            role='search' aria-label='Map search'
            style={{ ['--sc-accent' as any]: custom?.barAccent || '#003A55' }}>
            {(props.useDataSources || []).map((uds: any) => (
                <DataSourceComponent key={uds.dataSourceId} useDataSource={uds} widgetId={props.id}
                    onDataSourceCreated={() => setDsReadyTick(t => t + 1)} />
            ))}
            <div className='search-box-wrap'>
                <div className='search-container' ref={searchContainerRef}></div>
                {custom?.searchHistoryEnabled && showHistory && history.length > 0
                    ? <div className='search-history-dropdown' ref={panelRef} role='listbox' aria-label='Recent searches'>
                        {history.map((t, i) => {
                            const ci = t.indexOf(',')
                            const primary = ci > -1 ? t.slice(0, ci) : t
                            const secondary = ci > -1 ? t.slice(ci + 1).trim() : ''
                            return (
                                <button key={`${t}-${i}`} type='button' role='option' aria-selected='false'
                                    className='shd-item' aria-label={`Search again for ${t}`}
                                    onMouseDown={(e: any) => { e.preventDefault(); selectHistory(t) }}
                                    onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectHistory(t) } }}>
                                    <span className='shd-icon' aria-hidden='true'>
                                        <svg viewBox='0 0 24 24' width='18' height='18'>
                                            <circle cx='12' cy='12' r='9' fill='none' stroke='currentColor' strokeWidth='1.6' />
                                            <path d='M12 7v5l3.5 2' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
                                        </svg>
                                    </span>
                                    <span className='shd-text'>
                                        <span className='shd-primary'>{primary}</span>
                                        {secondary ? <span className='shd-secondary'>{secondary}</span> : null}
                                    </span>
                                </button>
                            )
                        })}
                        <button type='button' className='shd-clear'
                            aria-label='Clear recent search history'
                            onMouseDown={(e: any) => { e.preventDefault(); clearHistory(); setShowHistory(false) }}>
                            Clear recent searches
                        </button>
                    </div>
                    : null}
            </div>
            {statusMsg
                ? <div className='search-status' role='status' aria-live='polite'
                    style={{ font: '12px/1.4 sans-serif', color: '#3a3a3a', padding: '4px 6px' }}>{statusMsg}</div>
                : null}
            <JimuMapViewComponent
                useMapWidgetId={useMapWidgetIds?.[0]}
                onActiveViewChange={handleActiveViewChange}
            />
        </div>
    )
}

export default Widget