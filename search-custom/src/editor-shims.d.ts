// Editor-only compatibility declarations for Experience Builder 1.21 + pnpm.
// IDE-only; emits no JavaScript and changes no runtime behavior. The EB webpack
// build resolves the real packages and never reads this file.
//
// This widget imports the ArcGIS Maps SDK through EB's `esri/*` alias, not the
// real `@arcgis/core` package, so Visual Studio never reads any file under
// client\node_modules and IDE1100 "Access denied" never fires. Each SDK module
// the widget imports is declared here as `any`; the classes are declared as
// classes so they work as both a value and a type. See WIDGETHANDOFF 12.3.

declare module 'esri/widgets/Search' {
  export default class Search {
    constructor(properties?: any)
    [key: string]: any
  }
}

declare module 'esri/layers/FeatureLayer' {
  export default class FeatureLayer {
    constructor(properties?: any)
    [key: string]: any
  }
}

declare module 'esri/Color' {
  export default class Color {
    constructor(value?: any)
    [key: string]: any
  }
}

declare module 'esri/core/reactiveUtils' {
  export const watch: any
  export const when: any
  export const once: any
  export const on: any
}

// Stylesheet side-effect imports (widget.scss). Editor-only.
declare module '*.scss'
declare module '*.css'
