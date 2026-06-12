/**
 * Configuration types for the Search (Custom) widget.
 *
 * This file is intentionally self-contained: it depends only on jimu-core for
 * the Immutable helper, so it is unaffected by changes to the OOTB Search
 * widget's setting-component types across Experience Builder versions.
 */
import { type ImmutableObject } from 'jimu-core'

/** Widget configuration. Everything the runtime reads lives under customConfig. */
export interface config {
  customConfig?: CustomSearchConfig
}

export type IMConfig = ImmutableObject<config>

// =============================================================================
// CUSTOM MASTER SEARCH TYPES
// =============================================================================

/** How the widget reacts when a result is selected. */
export enum CustomPopupMode {
  /** Only zoom to the result; do not open or customize any popup. */
  None = 'None',
  /**
   * Use each layer's OWN popup. For app data sources this is the popup
   * configured in the web map; for service-URL layers it falls back to an
   * auto-generated field popup. The widget does not override the template.
   */
  InheritWebMap = 'InheritWebMap',
  /**
   * Each feature-layer source gets an Arcade auto-field popup template that
   * lists every (non-excluded) field.
   */
  LayerTemplate = 'LayerTemplate',
  /**
   * On select-result, run one or more spatial-intersect lookups against
   * context layers and build a custom HTML popup (e.g. "is this address inside
   * a district?" messages or a parcel/feature field dump).
   */
  SpatialLookup = 'SpatialLookup'
}

export enum CustomSourceKind {
  FeatureLayer = 'FeatureLayer',
  Geocode = 'Geocode',
  DataSource = 'DataSource'
}

export interface ResultSymbolConfig {
  /** [r, g, b, a] – a is 0..1. */
  color?: number[]
  size?: number
}

/** One entry in the search box's source dropdown. */
export interface CustomSearchSource {
  id: string
  kind: CustomSourceKind
  name: string
  placeholder?: string
  url: string
  outFields?: string[]
  /** For kind === DataSource: the EB data source id this source is bound to.
   *  The matching UseDataSource lives in the widget's `useDataSources` (managed
   *  by Experience Builder), and the runtime resolves the layer from it. Note:
   *  data-source bindings are app-specific and are NOT carried by XML export. */
  dataSourceId?: string
  // --- FeatureLayer source ---
  searchFields?: string[]
  displayField?: string
  exactMatch?: boolean
  zoomScale?: number
  // --- Geocode (locator) source ---
  singleLineFieldName?: string
  maxSuggestions?: number
  maxResults?: number
  suggest?: boolean
  resultSymbol?: ResultSymbolConfig

  // --- Shared "bells & whistles" (map 1:1 to ArcGIS SearchSource props) ---
  /** Text automatically prepended to the user's input before searching. */
  prefix?: string
  /** Text automatically appended to the user's input before searching. */
  suffix?: string
  /** Minimum characters before suggestions are requested. */
  minSuggestCharacters?: number
  /** Whether autocomplete suggestions are enabled for this source. */
  suggestionsEnabled?: boolean
  /** Restrict results to the current map extent. */
  withinViewEnabled?: boolean
  /** Definition expression applied to this source (LayerSearchSource.filter / LocatorSearchSource.filter where clause). */
  filterWhere?: string
  // --- Geocode-only extras ---
  /** ISO country code(s) to limit a locator search, e.g. 'US' or 'US,CA'. */
  countryCode?: string
  /** Locator categories to limit results, e.g. ['Address','Postal']. */
  categories?: string[]
  /** Locator searchTemplate string. */
  searchTemplate?: string
  /** Geocoder location type, e.g. 'street' or 'rooftop'. */
  locationType?: string
  /** Per-source custom Arcade popup (LayerTemplate mode). Overrides the shared
   *  expression for just this source's layer. Empty = use the shared one. */
  popupArcade?: string
}

/** Reusable URL-formatting rule, applied to field values that look like links. */
export interface UrlRule {
  id: string
  matchType: 'startsWith' | 'endsWith' | 'contains'
  /** Matched case-insensitively, e.g. 'map/', '.pdf', 'resdoc/'. */
  pattern: string
  /** Prefix prepended to the value. Empty string => use the value verbatim. */
  baseUrl: string
  /** Link text shown to the user. */
  linkText?: string
}

export enum LookupOutputType {
  /** Inside/outside boundary message, e.g. sewer district / city limits. */
  InOutMessage = 'InOutMessage',
  /** A list of fields from the intersected feature, e.g. parcel details. */
  FieldList = 'FieldList'
}

export interface StaticLine {
  label: string
  value: string
  /** Render value as a link. */
  isLink?: boolean
  /** Optional explicit href; if omitted and isLink, value is used as href. */
  href?: string
}

export interface LookupFieldConfig {
  field: string
  /** Overrides the layer's field alias. */
  label?: string
}

/** A single spatial-lookup rule run on select-result in SpatialLookup mode. */
export interface LookupRuleConfig {
  id: string
  enabled: boolean
  /** Layer queried by intersect against the selected point. */
  layerUrl: string
  spatialRelationship?: string // default 'intersects'
  outputType: LookupOutputType

  // --- InOutMessage ---
  /**
   * Shown when the point intersects a feature. Supports tokens:
   *   {result}        -> the search result name/address
   *   {field:NAME}    -> value of attribute NAME on the matched feature
   */
  insideMessage?: string
  /** Shown when there is no intersecting feature. Supports {result}. */
  outsideMessage?: string
  /** Static extra lines appended under an inside match (e.g. phone/address). */
  staticLines?: StaticLine[]
  /** Optional field read from the matched feature. Prefer the {field:NAME}
   *  token inside insideMessage; this is kept for convenience only. */
  readField?: string

  // --- FieldList ---
  /** Optional heading rendered above the field list (e.g. 'Parcel Details'). */
  sectionHeading?: string
  /** true => render every field except excludedFields; false => only `fields`. */
  includeAllFields?: boolean
  fields?: LookupFieldConfig[]
  excludedFields?: string[]
  applyUrlRules?: boolean
  applyDateFormatting?: boolean
  applyCodedValues?: boolean
  /** Shown when no feature is found at the location. */
  noResultMessage?: string
}

/** Maps to ArcGIS MapView Popup (view.popup) display capabilities. */
export interface PopupDisplayConfig {
  /** Dock the popup to a side of the view instead of pointing at the feature. */
  dockEnabled?: boolean
  /** Dock location when docked. */
  dockPosition?: 'auto' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  /** Auto-dock on small screens (dockOptions.breakpoint). */
  dockBreakpoint?: boolean
  /** Show the dock/undock toggle button (dockOptions.buttonEnabled). */
  dockButton?: boolean
  /** Allow collapsing the popup to just its header. */
  collapseEnabled?: boolean
  /** Highlight the selected feature on the map. */
  highlightEnabled?: boolean
  /** Open automatically when a result is selected (view.popup.autoOpenEnabled). */
  autoOpenEnabled?: boolean
  /** Number of actions shown inline before overflowing to a menu. */
  maxInlineActions?: number
  // --- visibleElements ---
  visibleCloseButton?: boolean
  visibleCollapseButton?: boolean
  visibleFeatureNavigation?: boolean
  visibleHeading?: boolean
  visibleActionBar?: boolean
  visibleSpinner?: boolean
}

export interface CustomSearchConfig {
  /** Master on/off. When false the widget renders nothing custom. */
  enabled: boolean
  /** MapView popup display options (apply whenever popups are shown). */
  popupOptions?: PopupDisplayConfig
  /** Fixed pixel width of the search container (matches the original 300px). */
  containerWidth?: number
  allPlaceholder?: string
  includeDefaultSources?: boolean
  /** Zoom scale used after a result is selected. */
  defaultZoomScale?: number

  // --- Search-widget-level options (map 1:1 to ArcGIS Search props) ---
  /** Auto-select the first result on search. */
  autoSelect?: boolean
  /** Show the "All" entry that searches every source at once. */
  searchAllEnabled?: boolean
  /** Draw a graphic at the matched location. */
  resultGraphicEnabled?: boolean
  /** Master popup enable. Ignored in SpatialLookup mode (always on there). */
  popupEnabled?: boolean
  /** Show the "Use current location" button. */
  locationEnabled?: boolean
  /** Enable autocomplete suggestions globally. */
  suggestionsEnabled?: boolean
  /** Minimum characters before global suggestions fire. */
  minSuggestCharacters?: number
  /** Global max results across sources. */
  maxResults?: number
  /** Global max suggestions across sources. */
  maxSuggestions?: number
  /** Pre-fill the search box with this term on load. */
  initialSearchTerm?: string
  /** Index of the source selected by default (-1 = the "All" entry). */
  activeSourceIndex?: number
  /** Remember the user's recent searches in this browser (localStorage). */
  searchHistoryEnabled?: boolean
  /** How many recent searches to keep (default 5). */
  searchHistoryMax?: number

  // --- Result navigation & popup behavior ---
  /** Pan/zoom to a result when selected (default true). */
  autoNavigate?: boolean
  /**
   * How the map moves to a selected result:
   *   'scale'  (default) - go to the result location at the source's fixed
   *                        zoom scale (current behavior).
   *   'extent'           - fit the map to the result's full extent (best for
   *                        polygon/line results like parcels or districts);
   *                        point results fall back to the fixed scale.
   */
  navigateMode?: 'scale' | 'extent'
  /** Open the popup when a result is selected (default true). */
  popupOpenOnSelect?: boolean
  /** Animate the zoom-to-result instead of jumping (default false). */
  zoomAnimate?: boolean
  /** Animation duration in milliseconds when zoomAnimate is true. */
  zoomDuration?: number

  // --- Placement ---
  /** 'widget' renders the box where the widget is placed; 'map' docks it on the
   *  map at mapPosition. */
  placement?: 'widget' | 'map'
  /** Map dock position when placement === 'map'. */
  mapPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'manual'

  // --- Appearance ---
  /**
   * Search-bar visual template, mirroring (and extending) Esri's arrangement
   * styles:
   *   'default'  - the Search widget's native look (no overrides).
   *   'square'   - sharp 0-radius corners.
   *   'curve'    - fully rounded / pill-shaped box.
   *   'linear'   - borderless box with a single underline (minimal).
   *   'floating' - elevated rounded card with a soft shadow.
   *   'soft'     - filled, borderless light pill.
   */
  barStyle?: 'default' | 'square' | 'curve' | 'linear' | 'floating' | 'soft'
  /** Search-bar size (control height + font). Default 'comfortable'. */
  barSize?: 'compact' | 'comfortable' | 'large'
  /** Accent color (hex) for the focus ring / button hover across looks. */
  barAccent?: string

  /** The search box sources, in display order. */
  sources: CustomSearchSource[]

  popupMode: CustomPopupMode

  // --- LayerTemplate mode ---
  /** Popup title template for feature layers, e.g. '{LOCATION}'. */
  popupTitleTemplate?: string
  /** Field names excluded from the auto-field popup (case-insensitive). */
  arcadeFieldsToExclude?: string[]
  /**
   * 'generated' (default) builds the Arcade expression automatically from the
   * excluded-field list and URL rules. 'custom' uses `arcadeExpression`
   * verbatim - written and stored entirely in the settings panel.
   */
  arcadeMode?: 'generated' | 'custom'
  /** The Arcade expression used when arcadeMode === 'custom' (edited in settings). */
  arcadeExpression?: string

  // --- SpatialLookup mode ---
  /** Title used for the spatial-lookup popup. Supports {result}. */
  spatialPopupTitle?: string
  lookupRules?: LookupRuleConfig[]

  /** Shared URL-formatting rules used by both modes. */
  urlRules?: UrlRule[]
}

export type IMCustomSearchConfig = ImmutableObject<CustomSearchConfig>
