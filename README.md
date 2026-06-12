# Search Custom widget

A customized ArcGIS Experience Builder Search widget for the City of Grand Junction, CO. It extends Esri's stock Search widget into a single, settings-driven widget: multi-source search (feature layers, geocoders, and app data sources), optional Arcade auto-field layer popups, web-map popup inheritance, spatial-lookup popups, a full set of MapView popup display options, and XML export/import to move whole configurations between apps without re-keying them.

The downloadable widget lives in the `search-custom` subfolder. Download a release, drop that folder into your Experience Builder install, and run the standard client `npm install`. See the widget's own README for the feature list and install steps.

## Repository layout

```
search-custom-widget/            <- this repo
├── README.md                    <- this file (GitHub landing page)
├── LICENSE                      <- Apache-2.0
├── NOTICE                       <- attribution for the derivative work
├── .gitignore                   <- ignores node_modules, .vs, dist, OS cruft
├── SECURITY.md                  <- how to report a vulnerability
├── publish.ps1                  <- one-command publish/update automation
└── search-custom/               <- the widget (drops into your-extensions/widgets)
    ├── package.json
    ├── package-lock.json        <- generated in the EB environment
    ├── manifest.json
    ├── README.md                <- install steps and feature list
    ├── LICENSE
    ├── NOTICE
    └── src/ ...
```

## Install (for users)

See [search-custom/README.md](search-custom/README.md). In short: download the release zip, place the `search-custom` folder so its `manifest.json` sits directly inside `client/your-extensions/widgets/search-custom/`, then run `npm install` in the `client` folder and restart.

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

Post: (add the Esri Community Experience Builder Custom Widgets post link here once published)

## Credits and license

This widget is a derivative work based on Esri's ArcGIS Experience Builder "Search" widget (by Esri R&D Center Beijing), which Esri publishes under the Apache License, Version 2.0. It has been modified and extended by the City of Grand Junction, CO.

Licensed under Apache-2.0. See [LICENSE](LICENSE) for the full terms and [NOTICE](NOTICE) for attribution. Original work copyright Esri; modifications copyright City of Grand Junction, CO. This software is free to use, modify, and redistribute under those terms.
