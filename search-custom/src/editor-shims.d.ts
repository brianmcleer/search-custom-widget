// Editor-only compatibility declarations for Experience Builder 1.21 + pnpm.
// These declarations do not change runtime behavior.

declare module '@arcgis/core/widgets/Search' {
  export default class Search {
    constructor(properties?: any)
    [key: string]: any
  }
}

declare module '@arcgis/core/layers/FeatureLayer' {
  export default class FeatureLayer {
    constructor(properties?: any)
    [key: string]: any
  }
}

declare module '@arcgis/core/Color' {
  export default class Color {
    constructor(value?: any)
    [key: string]: any
  }
}

declare module '@arcgis/core/core/reactiveUtils' {
  export const watch: any
  export const when: any
  export const once: any
  export const on: any
}
