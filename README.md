# Search Custom widget

[![License](https://img.shields.io/github/license/brianmcleer/search-custom-widget)](LICENSE) [![Release](https://img.shields.io/github/v/release/brianmcleer/=tag)](https://github.com/brianmcleer/search-custom-widget/releases) [![Issues](https://img.shields.io/github/issues/brianmcleer/search-custom-widget)](https://github.com/brianmcleer/search-custom-widget/issues)

A customized ArcGIS Experience Builder Search widget for the City of Grand Junction, CO. It extends Esri's stock Search widget into a single, settings-driven widget: multi-source search (feature layers, geocoders, and app data sources), optional Arcade auto-field layer popups, web-map popup inheritance, spatial-lookup popups, a full set of MapView popup display options, and XML export/import to move whole configurations between apps without re-keying them.

The downloadable widget lives in the `search-custom` subfolder. Download a release, drop that folder into your Experience Builder install, and run the standard client `npm install`. See the widget's own README for the feature list and install steps.

## Repository layout

```
search-custom-widget/            <- this repo
â”œâ”€â”€ README.md                    <- this file (GitHub landing page)
â”œâ”€â”€ LICENSE                      <- Apache-2.0
â”œâ”€â”€ NOTICE                       <- attribution for the derivative work
â”œâ”€â”€ .gitignore                   <- ignores node_modules, .vs, dist, OS cruft
â”œâ”€â”€ SECURITY.md                  <- how to report a vulnerability
â”œâ”€â”€ publish.ps1                  <- one-command publish/update automation
â””â”€â”€ search-custom/               <- the widget (drops into your-extensions/widgets)
    â”œâ”€â”€ package.json
    â”œâ”€â”€ package-lock.json        <- generated in the EB environment
    â”œâ”€â”€ manifest.json
    â”œâ”€â”€ README.md                <- install steps and feature list
    â”œâ”€â”€ LICENSE
    â”œâ”€â”€ NOTICE
    â””â”€â”€ src/ ...
```

## Install (for users)

See [search-custom/README.md](search-custom/README.md). In short: download the release zip, place the `search-custom` folder so its `manifest.json` sits directly inside `client/your-extensions/widgets/search-custom/`, then run `npm install` in the `client` folder and restart.

### The release zip and the editor shims

The zip is the widget only. The Visual Studio type shims in the repo (`search-custom/src/editor-shims.d.ts`, `search-custom/src/exb-editor-shims.d.ts`) are left out on purpose: their ambient `declare module` blocks are not file-scoped and would rewrite the react, jimu and esri types for every other widget in your `your-extensions` folder.

If you clone the repository instead of using the zip, delete `search-custom/src/editor-shims.d.ts` and the other shim files listed above before building; nothing else depends on them.

## Requirements

- ArcGIS Experience Builder Developer Edition 1.19 or 1.20 (React 19). EB 1.18 and earlier are not supported.

## Publishing updates (for the maintainer)

The widget is developed in the Experience Builder install, then synced into this repo and pushed with `publish.ps1`. Edit the three variables at the top of the script the first time on a new machine, then:

```
# Code update only
powershell -ExecutionPolicy Bypass -File .\publish.ps1

# Code update plus a new downloadable release
powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.1.0
```

The script mirrors the widget from the EB folder into the `search-custom` subfolder (skipping `node_modules` and `.vs`), commits, pushes, and optionally cuts a versioned GitHub release with a downloadable zip. Tags must increase and never repeat.

## Esri Community

Post: <https://community.esri.com/t5/experience-builder-custom-widgets/search-custom/ba-p/1707992>

## Changelog

**07/07/2026:** Fixed an issue where the search bar could show up blank after importing a configuration, or drop behind the map, header, or sidebar in certain layouts. Also hardened the widget so a single bad imported setting no longer blanks the whole search box.

**06/12/2026:** Initial public release on GitHub and Esri Community.

## Credits and license

This widget is a derivative work based on Esri's ArcGIS Experience Builder "Search" widget (by Esri R&D Center Beijing), which Esri publishes under the Apache License, Version 2.0. It has been modified and extended by the City of Grand Junction, CO.

Licensed under Apache-2.0. See [LICENSE](LICENSE) for the full terms and [NOTICE](NOTICE) for attribution. Original work copyright Esri; modifications copyright City of Grand Junction, CO. This software is free to use, modify, and redistribute under those terms.
