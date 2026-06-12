# Search (Custom) - a configurable, settings-driven Search widget

A single ArcGIS Experience Builder widget that wraps the ArcGIS Maps SDK
`Search` widget and exposes its behavior entirely through the **settings
panel** - no code changes required. Configure search sources, popups, spatial
lookups, and URL formatting per instance, and move whole configurations between
apps with **XML export / import**.

This is a generic, shareable widget: it ships with **no organization-specific
data baked in**. Drop it into any Experience Builder install and configure it
for your own services.

## Requirements

- ArcGIS Experience Builder Developer Edition 1.19 or 1.20 (built and tested on these; they run React 19).
- Experience Builder 1.18 and earlier run React 18 and are not supported.
- This widget declares no extra npm dependencies; it uses only the ArcGIS Maps SDK and Experience Builder framework modules that EB already provides.

## What it does

Three popup behaviors, chosen per instance:

- **None** - search and zoom to the result, no popup.
- **Layer auto-field popup (Arcade)** - each feature-layer source gets an Arcade
  popup that lists every (non-excluded) field automatically; values that look
  like links become clickable via your URL rules.
- **Spatial lookup popup** - when a result is selected, run one or more
  spatial-intersect queries against context layers and build a custom HTML
  popup (e.g. "is this address inside a district?" messages, or a field dump of
  the intersected feature).

Plus a full set of ArcGIS `Search` options (auto-select, "All" source, use-my-
location, suggestions, max results, within-view, prefix/suffix, filters, etc.).

## Install

1. Download the release zip and extract it.
2. Copy the `search-custom` folder into your Experience Builder client extensions folder so that `manifest.json` sits directly inside:

   ```
   client/your-extensions/widgets/search-custom/manifest.json
   ```

   Do not nest it a second level deep (for example `widgets/search-custom/search-custom/`). A second-level nest is the usual reason a widget does not register.
3. From the `client` folder, run `npm install`. Experience Builder installs widget dependencies automatically from `package.json`, so there are no per-dependency commands to run. This widget declares no extra dependencies, so this step is just the standard client install.
4. Start or restart the client (`npm start`), then hard-refresh the builder (Ctrl+Shift+R).
5. Add **Search (Custom)** to a page, select the map widget in settings, then configure it (or import an XML configuration, see below).

## Transferring configurations between apps (XML export / import)

The **Transfer settings (XML)** section at the top of the settings panel lets a
configuration move between apps, orgs, or environments without re-keying it:

- **Export XML file** - downloads the current configuration as a portable,
  human-readable `.xml` file. Every value is type-tagged, so the round-trip is
  exact: strings, numbers, booleans, and nested arrays/objects all survive.
- **Import / view XML** - expands a panel where you can:
  - **Choose .xml file…** to load an exported file,
  - paste exported XML and **Apply pasted XML**, or
  - read the **current configuration** as XML (read-only) to copy by hand.

Imported values are merged onto the current defaults, so an export that predates
a newly added option still imports cleanly. The format is defined in
`src/setting/config-xml.ts` (root element `<searchCustomConfig schemaVersion="1">`).

### Starting from an example instead of scratch

If you received example `.xml` configuration files alongside this widget, you do
not have to build a configuration by hand - just open the settings panel,
**Import / view XML → Choose .xml file…**, pick one, then edit the service URLs
and field names to match your own org. (These examples are *not* bundled inside
the widget, so the widget itself stays generic.)

## Settings reference

Everything lives under `config.customConfig` (`CustomSearchConfig` in
`src/config.ts`).

### General
- **Enable custom search** - master on/off.
- **Search box width (px)** - fixed container width.
- **"All" placeholder** - text for the combined "All" source.
- **Zoom scale on result** - scale applied after a result is selected.
- **Popup behavior** - `None` (zoom only), `InheritWebMap` (use each layer's own
  popup - the web map popup for app data sources, or an auto field popup for
  service-URL layers; the widget adds none of its own), `LayerTemplate` (Arcade
  auto-field), or `SpatialLookup` (see above).
- **Initial search term** - pre-fills the search box on load.

### Popup display (map popup) - when popups are shown
Maps to the MapView Popup (`view.popup`): **dock the popup** (`dockEnabled`) +
**position**/`auto-dock on small screens`/`dock button`, **collapsible popup**,
**highlight selected feature**, **open automatically on select**, **max inline
actions**, and which **visible parts** show (close button, collapse button,
feature navigation, heading, action bar, spinner). These configure the map's
shared popup, so they also affect other popups opened on the same map.

### Search behavior (maps 1:1 to the ArcGIS Search widget)
- **Auto-select first result** (`autoSelect`).
- **Show "All"** (`searchAllEnabled`) - the combined all-sources entry.
- **Show "Use current location"** (`locationEnabled`).
- **Draw result graphic** (`resultGraphicEnabled`).
- **Enable suggestions** (`suggestionsEnabled`) + **Min. suggest characters**
  (`minSuggestCharacters`).
- **Max results / Max suggestions** (`maxResults` / `maxSuggestions`).
- **Enable popups** (`popupEnabled`) - applies in None/Layer modes
  (SpatialLookup always opens its custom popup).
- **Default source index** (`activeSourceIndex`) - which source the box starts on (-1 = All).

### Result navigation
- **Zoom to result on select** (`autoNavigate`), **How the map moves to a
  result** (`navigateMode`: `scale` = fixed zoom scale, or `extent` = fit the
  map to the result's full extent - best for parcels, districts and streets;
  point results fall back to the fixed scale), **Animate the zoom**
  (`zoomAnimate`) + **duration** (`zoomDuration` ms), and **Open popup on
  result select** (`popupOpenOnSelect`). All of these apply live, without
  rebuilding the search box.

### Recent searches
- **Remember recent searches** (`searchHistoryEnabled`, off by default). When
  on, focusing the (empty) search box opens a Google-style dropdown of the
  user's recent selected results - each with a clock icon and a primary/secondary
  line - and it closes as soon as they start typing or click away. Clicking an
  item re-runs that search; a "Clear recent searches" row empties the list.
  **How many to remember** (`searchHistoryMax`, default 5). History is stored
  only in the visitor's own browser via `localStorage` (key
  `search-custom-history:<widgetId>`) - per-visitor, never transmitted.

### Placement
- **Where the search box appears** (`placement`): in the widget where placed, or
  **docked on the map** at a **Map position** (`mapPosition`: top-left/-right,
  bottom-left/-right, manual).

### Appearance
- **Search bar style** (`barStyle`): `default` (native), `square` (sharp
  corners), `curve` (rounded / pill), `linear` (borderless underline),
  `floating` (elevated card with a soft shadow), or `soft` (filled pill).
- **Search bar size** (`barSize`): `compact`, `comfortable`, or `large` -
  controls the box height and font size.
- **Accent color** (`barAccent`, hex): drives the focus ring and button-hover
  color across the non-default styles.
  All three are purely visual and update live; `default` leaves the native look
  untouched.

Per-source options also map to the SDK: **prefix/suffix**, **suggestions for
this source**, **min suggest characters**, **only within current map view**
(`withinViewEnabled`), and a **filter where clause**. Geocode sources add **country code(s)**, **categories**, **search template**, and **location type** (street/rooftop). Feature-layer sources can set a **result symbol color** and a **per-source custom Arcade popup** that overrides the shared one.

### Search sources
An ordered list; each is one entry in the search dropdown.
- **Feature layer** source: name, placeholder, service URL, search fields,
  display field, exact match, zoom scale.
- **Geocode** source: name, placeholder, geocode URL, single-line field, max
  suggestions/results, and an optional result-symbol color `[r,g,b,a]`.
- **App data source** source: pick a feature layer from this Experience's own
  data sources (web map layers, added layers, output data, etc.) in the **App
  data sources** picker. Each selection becomes a search source with the same
  field/zoom options as a feature-layer source - no service URL to paste. The
  binding is managed through the widget's `useDataSources` and is **app-specific**,
  so it is not carried by the XML export (the source entry is, but it must be
  re-bound to a data source in the target app).

### Layer popup (Arcade) - `LayerTemplate` only
- **Popup title template** - e.g. `{LOCATION}`.
- **Excluded fields** - comma list of fields hidden from the auto popup.
- URL-looking values are turned into links by the **URL formatting rules**.

### Spatial lookup rules - `SpatialLookup` only
- **Popup title** - supports tokens `{result}` and `{field:NAME}`.
- Each **rule** intersects the selected point with a layer and outputs either:
  - **Inside/Outside message** - `insideMessage` (tokens allowed) shown on a
    match, optional `staticLines` (e.g. phone/address, with links), and
    `outsideMessage` shown otherwise.
  - **Field list** - lists fields from the matched feature; either *all fields*
    minus an excluded list, or an *explicit list* of `{field,label}`; with URL,
    date and coded-value formatting toggles, a section heading, and a
    no-result message.
- Multiple rules append in order, separated by a divider, into one popup.

### URL formatting rules (shared)
Field values matching a rule render as links. Each rule: match type
(`startsWith` / `endsWith` / `contains`), pattern (case-insensitive), base URL
(prefix; empty = use value verbatim), and link text. These drive both the
Arcade popup and the spatial-lookup field lists.

## Tokens
Usable in spatial-lookup messages and the popup title:
- `{result}` - the selected result's name/address.
- `{field:NAME}` - value of attribute `NAME` on the intersected feature.

## Files of interest
- `src/config.ts` - `CustomSearchConfig` and related types.
- `src/runtime/widget.tsx` - the config-driven runtime.
- `src/runtime/custom-search.ts` - Arcade generator, URL formatting, token
  substitution, in/out + field-list HTML builders.
- `src/setting/setting.tsx` - the custom settings panel.
- `src/setting/config-xml.ts` - the lossless XML export/import serializer.

## Troubleshooting: `search-custom is duplicated`

This means the widget name is registered more than once, so a second copy is present somewhere in the install. Replacing just one folder does not fix it. Check, in order:

1. A nested folder: `widgets/search-custom/search-custom/`. The manifest must sit directly inside the widget folder, not a second level deep.
2. A leftover folder from an earlier build or version, including any `-copy` folder or a folder under a previous name. (Note: the original Esri OOTB widget is named `search`, so this custom widget will not collide with it by name.)
3. A stale compiled build in `client/dist/widgets`. Stop the client, delete the matching folder under `dist/widgets` (or run a clean build), then start again. This is common after moving a widget between EB versions, because the build can see both the new source and the old compiled output.

If removing one copy makes the widget disappear from the Entrypoint list entirely, the copy that remains is nested too deep. Move it so the manifest is directly inside the widget folder.

## Feedback

Questions and issues are welcome on the Esri Community Experience Builder Custom Widgets post (https://community.esri.com/t5/experience-builder-custom-widgets/search-custom/ba-p/1707992), or as a GitHub issue on this repository.

## Credits and license

This widget is a derivative work based on Esri's ArcGIS Experience Builder "Search" widget (by Esri R&D Center Beijing), which Esri publishes under the Apache License, Version 2.0. It has been modified and extended by the City of Grand Junction, CO.

Licensed under Apache-2.0. See [LICENSE](LICENSE) for the full terms and [NOTICE](NOTICE) for attribution. Original work copyright Esri; modifications copyright City of Grand Junction, CO. This software is free to use, modify, and redistribute under those terms.
