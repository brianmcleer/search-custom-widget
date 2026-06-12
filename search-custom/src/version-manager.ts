import { BaseVersionManager } from 'jimu-core'

/**
 * The custom Search widget stores all of its configuration under
 * `config.customConfig` and does not use the OOTB output-datasource pipeline,
 * so no schema migrations are required. A no-op version manager avoids running
 * the original Search migrations against the custom config shape.
 */
class VersionManager extends BaseVersionManager {
  versions = []
}

export const versionManager = new VersionManager()
