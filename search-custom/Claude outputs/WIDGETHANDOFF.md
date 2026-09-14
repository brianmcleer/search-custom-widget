# ArcGIS Experience Builder Custom Widget - Handoff / Playbook

Paste this whole file into the **first message** of a new project (or into the project's
custom instructions) when starting the next widget. A new project cannot see prior
project chats, so this document is the bridge that carries over every decision and tool.

---

## 1. Who this is for and the goal

- **Author:** Brian McLeer, GIS Administrator/Developer, City of Grand Junction, CO.
- **What we do:** build ArcGIS Experience Builder custom widgets, package them so they
  are easy for other developers to install, publish them to GitHub, and post them on
  Esri Community.
- **Standardization goal:** follow the community packaging conventions so widgets are
  discoverable and install with no manual dependency steps. This came out of two Esri
  Community threads (links in Section 7).

The first two widgets done this way were **Property Report** and **Mailing Labels**.
The third, **Droplets** (saved map states, bought from an outside developer and now
maintained by the GIS Division), added the runtime conventions in Sections 10 to 16:
the in-widget help guide, the theme-token UI rules, the EB 1.21 gotchas, the testing
harness and the checklist for taking over someone else's widget. This playbook
generalizes all of that so the next widget follows the same clean process.

---

## 2. Packaging conventions (apply to every widget)

These come from the "Standardizing Custom Widget Sharing" discussion plus what we
verified in Esri's docs.

1. **`package.json`** at the widget root, containing:
   - `name`: the widget's package name. Keep the plain widget name (no `exb-` prefix).
     Discoverability is driven by the keywords below, not the name.
   - `version`: match the widget's `manifest.json` version.
   - `description`: a real one-sentence description.
   - `keywords`: include `exb-widget`, `experience-builder`, `exb` (these make it show
     up in the community `exb search` CLI). Add a few topical ones too.
   - `license`: `Apache-2.0` (Esri's convention for ExB resources; also matches the
     manifest's license URL).
   - `author`: `Brian McLeer`.
2. **`tsconfig.json`** in the widget folder, next to `manifest.json`, plus
   `src/exb-editor-shims.d.ts` and (when the widget uses `__esri.X`) `src/runtime/esri.d.ts`.
   Required on EB 1.21+ so Visual Studio type checks the widget instead of flooding the
   Error List (pnpm layouts break VS's fallback analysis). Inert to the build (`noEmit`).
   Section 12, item 3 has the two modes (paths vs self-contained), the test that picks
   between them, and where the master copies live. Copy the files from the master; do not
   write them fresh. Include `tests/**/*.ts` in `include` if the widget ships tests
   (Section 14). EB-1.21-TSCONFIG-HANDOFF.md describes the older paths mode only.
3. **`package-lock.json`** generated in the real EB environment (see Section 4), so
   downstream users get the exact tested dependency versions and avoid drift.
4. **`README.md`** at the widget root: overview, features, requirements, install steps,
   feedback link. Two things the README must always include, because they are what
   prevent the most common downstream support tickets:
   - **Exact folder placement** in the install steps: state that `manifest.json` sits
     directly inside `your-extensions/widgets/<widget-name>/`, never nested a second level
     deep (for example `widgets/<widget-name>/<widget-name>`). Nesting is the usual cause
     of a widget not registering.
   - **A short troubleshooting note** for the `<name> is duplicated` build error. Use the
     reusable version in Section 9.
5. **`LICENSE`** file: full Apache-2.0 text, copyright "City of Grand Junction, CO".
6. **`.gitignore`** and **`.npmignore`**: exclude `node_modules`, `.vs`, `Claude outputs/`,
   `*.zip`, and OS cruft.
7. **Never ship** `node_modules`, the `.vs` Visual Studio cache folder, or the
   **`Claude outputs`** working folder. Cowork writes deliverables and zips into
   `Claude outputs` inside the live EB widget folder (the folder is connected to Cowork so
   files can be committed straight into EB). It is scratch, not source. `publish.ps1` lists
   it in `$ExcludeDirs`, skips it in the robocopy, and deletes it from the repo copy if an
   earlier run mirrored it. Basemap Gallery Custom v1.21.3 shipped with that folder inside
   the release zip before the exclusion existed; the release was deleted and cut again. Be aware that
   `.gitignore` and `.npmignore` only keep the GitHub copy clean; they do **not** affect a
   Windows right-click "Send to, Compressed folder" zip. So always build the Esri
   attachment zip from the cleaned repo subfolder (which `publish.ps1` already strips of
   `node_modules` and `.vs`), never from the live EB widget folder. Zipping the live EB
   folder is how cruft leaks into a download, for example a renamed widget's old `.vs`
   cache carrying its previous name.

### Repo-level vs widget-level files

`README.md`, `LICENSE`, and `.gitignore` appear at both the repo root (next to
`publish.ps1`) and inside the widget subfolder. These are not duplicates with the same
content; they serve different audiences.

- **Repo-level files** are the GitHub landing page. The README covers project overview,
  the repo layout diagram, instructions for running `publish.ps1`, and the link to the
  Esri Community post.
- **Widget-level files** travel with the widget into someone else's EB install when
  they download the zip from a release. The widget-level README has the exact install
  steps (folder placement, `npm install` in `client`, restart), the feature list, and
  the `<name> is duplicated` short troubleshooting note (Section 9). The widget-level
  LICENSE is the same Apache-2.0 text and needs to be present so the license travels
  with the widget when it is redistributed.

### Why no manual installs are needed (verified)

Esri's docs ("Using third-party libraries") confirm: Experience Builder automatically
installs all widget dependencies listed in a widget's `package.json` when you run
`npm install` in the **client** folder, and this only happens for widgets in the
`your-extensions` folder. So once the widget has a `package.json` (and `package-lock.json`),
other developers do **not** run any per-dependency install commands. They run the same
standard EB client install they already do.

### What belongs in `package.json`, and what must never go in it

This one has cost real build breaks in both directions, so treat it as a rule rather than a
judgment call.

**Experience Builder supplies these. They are imports, not dependencies.** Never add them to
`package.json`; EB resolves and bundles them itself:

| Import | What it gives you |
|---|---|
| `jimu-core` | `React`, `jsx`, `css`, `getAppStore`, `useIntl`, `DataSourceManager`, `Immutable` |
| `jimu-ui` | `Button`, `TextInput`, `Select`, `Switch`, `Checkbox`, `Alert`, `Tooltip`, `Tabs`, `Tab`, `Loading`, and the full `Modal` family (`Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`) |
| `jimu-ui/advanced/setting-components` | `SettingSection`, `SettingRow`, `MapWidgetSelector` |
| `jimu-arcgis` | `JimuMapView`, `JimuMapViewComponent`, `loadArcGISJSAPIModules` |
| `jimu-theme` | `useTheme`, which backs `useTokens()` (Section 11.2) |
| `jimu-icons/...` | the jimu icon set |
| `calcite-components` | `CalciteIcon`, `CalciteChip` (really `jimu-ui/calcite-components`) |
| `esri/*` | everything from the ArcGIS Maps SDK |
| `react`, `react/jsx-runtime` | React itself |

Droplets proves the point: it uses `Modal`, `CalciteIcon` and `useTheme` throughout and its
`package.json` has **no** `dependencies` block at all, only a dev-only `fake-indexeddb` for
tests.

**Anything else must be declared.** A `require('fflate')` added for a KMZ zip and not declared
broke the Print Advanced build with `Module not found: Error: Can't resolve 'fflate'`. The fix
was to drop the library and hand-write the ZIP writer (CRC-32 plus stored entries, about 60
lines), which is usually the right answer for something that small.

**Audit before every delivery.** This must print exactly the widget's declared dependency
names and nothing else:

```bash
grep -rhoE "from '[^']+'|require\('[^']+'\)" src \
  | sed -E "s/from '//;s/require\('//;s/'\)?$//" \
  | grep -vE "^(\.|esri/|jimu-|react($|/)|calcite-components$)" | sort -u
```

**When an EB-provided export is not certain**, do not gamble with a named import: a named
import of something a given EB build does not export fails the whole bundle. Read it lazily
instead, so the worst case is one feature going quiet:

```ts
const dataSourceList = (): any[] => {
  try {
    const core: any = require('jimu-core')
    const dsm = core?.DataSourceManager
    if (!dsm || typeof dsm.getInstance !== 'function') return []
    const all = dsm.getInstance().getDataSources()
    return Array.isArray(all) ? all : Object.keys(all ?? {}).map(k => all[k])
  } catch (e) { return [] }
}
```

Reserve that for the genuinely uncertain. Everything in the table above is certain: import it
by name and match the other widgets.

### Version compatibility note

- These widgets are built/tested on **EB Developer Edition 1.19 and 1.20**, which run
  **React 19**.
- **EB 1.18 and earlier run React 18 and are not supported** (the React 19 jump at 1.19
  is a hard breaking boundary for the dependencies and code).
- The manifest `exbVersion` field is informational today but Esri says it will be
  enforced later, so keep separate builds per EB version with matching `exbVersion`
  if you support more than one.
- Typical dependency set for these report-style widgets: `recharts`, `@tanstack/react-table`,
  `@mantine/charts`, `@mantine/dates`, `@mantine/notifications`, `dayjs`, `html2canvas`,
  `jspdf`. Pin Mantine on the 8.x line for React 19 unless you have tested 9.x.

---

## 3. Repo structure (per widget)

Each widget gets its own GitHub repo. The widget lives in a subfolder so the repo can
hold project-level files without polluting the shareable widget.

```
<widget-name>-widget/            <- the repo (e.g. property-report-widget)
├── README.md                    <- GitHub landing page
├── LICENSE                      <- Apache-2.0
├── .gitignore                   <- ignores node_modules, .vs, etc.
├── publish.ps1                  <- the automation script (Section 5)
└── <widget-name>/               <- the actual widget (drops into your-extensions/widgets)
    ├── package.json
    ├── package-lock.json
    ├── manifest.json
    ├── config.json
    ├── icon.svg
    ├── tsconfig.json                <- VS-only type check (Section 12, item 3)
    ├── README.md
    ├── LICENSE
    ├── .gitignore
    ├── .npmignore
    ├── (no Claude outputs/)         <- exists in EB only; publish.ps1 never copies it
    └── src/
        ├── exb-editor-shims.d.ts    <- VS-only ambient module shims (copied from master)
        ├── runtime/esri.d.ts        <- VS-only __esri interfaces, if the widget uses __esri.X
        └── ...
```

Keep all repos together under `Documents\GitHub\` (one folder per widget repo).

---

## 4. Generating the lockfile (once per widget, in the real EB env)

The lockfile must come from the actual EB environment so it reflects the tested
versions. In the widget folder inside EB:

```
cd C:\arcgis-experience-builder-1.20\client\your-extensions\widgets\<widget-name>
npm install
```

That writes `package-lock.json` next to `package.json`. Confirm the widget still builds
and runs, then it is ready to ship.

### EB 1.21 and later: pnpm replaces npm

Starting with EB 1.21, Esri switched to pnpm and `npm install` / `npm ci` error out
by design. The install is `npm i -g pnpm` once per machine, then `pnpm ci` in the
`client` folder (and `server` on a fresh install). Esri's bootstrap installs every
widget's dependencies automatically, so the per-widget install step above only
applies to EB 1.20 and earlier. On 1.21, pnpm writes `pnpm-lock.yaml` in the widget
folder; ship it alongside `package-lock.json` so both npm-era (1.19/1.20) and
pnpm-era (1.21+) users get locked dependency versions. The Windows npm-vs-npm-ci
guidance below applies to 1.20 and earlier only. (`node_modules` also appears here; it is ignored and
never shipped.)

### Handling `npm audit` warnings

`npm install` often prints "N vulnerabilities (M moderate, X critical)" because widget
dependencies like `jspdf` pull in transitive packages with known CVEs. Two paths:

- **`npm audit fix`** (no flag): updates within the existing SemVer ranges. Safe.
- **`npm audit fix --force`**: can bump major versions, which means the widget code may
  end up running against a different API than it was written for. The npm output will
  say "Updating <package> to <version>, which is a SemVer major change" when this
  happens. `--force` also rewrites `package.json` to the new version range.

Before committing after a `--force` upgrade:

1. Run `type package.json` (or `cat package.json`) to see what got rewritten.
2. Smoke-test the feature paths that touch the upgraded dependency. A successful
   webpack compile is not enough, because most dep usage happens at click time, not
   import time. For example, jspdf only runs at PDF-export click time, so you have
   to actually export a PDF to know the new version still works.
3. If the smoke test fails, either revert `package.json` and accept the audit warning
   (the moderate/critical labels are CVSS scores, not necessarily exploitable in a
   widget context), or fix the widget code to match the new API.

Known case: jspdf v2 carries a critical vuln through its `dompurify` transitive
dependency. Bumping to v3 or v4 resolves it. The basic jsPDF API (`new jsPDF()`,
`doc.text`, `doc.addPage`, `doc.save`, `setFont`, `setFontSize`, `setTextColor`,
`addImage`) is stable across v2 to v4, so most widgets survive the bump unchanged.
The `autoTable` plugin changed substantially across versions, so widgets that call
`doc.autoTable(...)` need code review before accepting the upgrade.

### Fixing Dependabot alerts (transitive CVEs, e.g. dompurify)

GitHub Dependabot scans the lockfiles committed to the repo and opens an alert for every
vulnerable dependency it finds, including transitive ones the widget never lists directly.
The recurring case for these report-style widgets is `dompurify`, pulled in transitively by
`jspdf`. Worked example from the Property Report widget: `jspdf` requested `dompurify ^3.3.1`,
which resolved to `3.4.11`, and that version carries the `IN_PLACE` detached-subtree XSS flaw
(advisory GHSA-55q2-fjhq-7xh7, affecting 3.4.12 and earlier) plus a lower-severity custom
element bypass. The patched version was `3.4.13`.

The fix is to force the transitive dependency to a patched version with an `overrides` block,
then regenerate the lockfiles so the pin actually takes. Four things tripped us up, and all
four are now written down so the next widget is a five-minute job instead of an afternoon.

1. **Patch the EB source folder, not the repo.** This is the big one. Because `publish.ps1`
   mirrors the EB widget folder over the repo with robocopy `/MIR` (Section 5), any edit made
   only in the repo is silently overwritten on the very next publish. Every dependency or
   security fix must be made in `client\your-extensions\widgets\<widget-name>` first, then
   published. Fixing the repo directly looks like it works, then reverts, and you chase your
   tail wondering why the alert never closes.

2. **npm and pnpm need separate override blocks.** npm reads a top-level `"overrides"` field.
   pnpm ignores that entirely and reads `"pnpm": { "overrides": { ... } }`. Since these
   widgets ship both `package-lock.json` and `pnpm-lock.yaml` (Section 4, pnpm note), the
   `package.json` must carry both blocks pinning the same version, or one lockfile stays
   vulnerable. The `dompurify` example looked like this:

   ```json
   "overrides": {
     "dompurify": "^3.4.13"
   },
   "pnpm": {
     "overrides": {
       "dompurify": "^3.4.13"
     }
   }
   ```

3. **Regenerate lockfiles without a full install.** From the EB widget source folder:

   ```powershell
   npm install  --package-lock-only --no-audit --no-fund   # updates package-lock.json
   pnpm install --lockfile-only                              # updates pnpm-lock.yaml
   ```

   PowerShell may block the npm/pnpm shims with "running scripts is disabled on this system".
   Clear it for the current session only (no admin needed) with
   `Set-ExecutionPolicy -Scope Process Bypass -Force`, or call the `.cmd` shims directly
   (`npm.cmd ...`, `pnpm.cmd ...`), which sidestep the policy.

4. **pnpm will not re-resolve a stale lockfile just because the override changed.**
   `pnpm install --lockfile-only` can report success and leave the old vulnerable version in
   place. If a verify (below) still shows the old version, delete the lockfile and let it
   rebuild clean: `Remove-Item pnpm-lock.yaml` then `pnpm install --lockfile-only`. A fresh
   resolve honors the override. (npm did not have this problem.) If a widget is npm-only and
   the `pnpm-lock.yaml` is just baggage, deleting it outright is a legitimate option too, but
   it drops locked versions for any pnpm-era (EB 1.21+) consumer, so prefer regenerating it.

**Always verify before publishing.** Confirm both lockfiles actually resolve to the patched
version, because "up to date" and a successful push do not prove the pin took:

```powershell
Select-String -Path .\<widget-name>\package-lock.json,.\<widget-name>\pnpm-lock.yaml -Pattern "dompurify"
```

Every hit should show the patched version and none should show the old one. Then publish from
the repo folder as usual.

Two closing notes. The `git push` output prints a cached "GitHub found N vulnerabilities" line
that reflects the branch state from before your push, so it is not evidence the fix failed;
Dependabot re-scans the new commit a few minutes later and closes the alerts then. And because
each vulnerability is counted once per lockfile, two lockfiles means the alert count doubles
(the Property Report repo showed four alerts for two underlying CVEs), which is normal and
clears as soon as both lockfiles carry the fix.

---

## 5. The automation script (publish.ps1)

This is generic. Reuse it for every widget. **Only three things change per widget:**
the `$ExbWidgetPath`, the `$RepoName`, and the widget subfolder name (which should match
the widget folder name in EB). Save this as `publish.ps1` at the repo root.

`$ExcludeDirs` and `$ExcludeFiles` hold the scratch folders and files that live in the EB
widget folder but must never ship: `node_modules`, `.vs`, `Claude outputs`, `*.zip`. Because
`/MIR` leaves excluded folders alone on the destination, the script also deletes any of
those folders from the repo copy after the sync, so a folder that was mirrored before it was
added to the list disappears on the next run. The release step refuses to run when the tag
already exists on GitHub and prints the `gh release delete` command to use first.

The script auto-runs `git init` on first use, so a fresh repo folder works without any
manual git setup.

`$ExbWidgetPath` points at a specific EB version folder. Bump it on every EB
upgrade (1.20 to 1.21 and onward) before publishing, or the script mirrors stale
files from the old install.

The robocopy step uses `/MIR` (mirror), which means the widget subfolder inside the repo
is brought into exact sync with the EB widget folder on every run. Any stale files that
exist in the repo subfolder but not in EB get removed automatically. This makes the
script safe to re-run, and means a hand-seeded or partially-seeded repo folder fixes
itself on the first run.

The flip side of `/MIR`: the EB widget folder is the single source of truth, so any change
you want to keep, including dependency and security fixes to `package.json` or the lockfiles,
must be made there and not in the repo. A repo-only edit is overwritten on the next publish.
See Section 4, "Fixing Dependabot alerts", for the full procedure.

```powershell
<#
  publish.ps1  -  One-command publish/update for an ExB custom widget repo.
  1. Copies the latest widget from the EB folder into this repo's widget subfolder
     (skips node_modules, .vs, and any working folders listed in $ExcludeDirs,
     such as "Claude outputs").
  2. Removes those excluded folders from the repo subfolder if an earlier run or a
     hand copy left them there, so they never reach GitHub or the release zip.
  3. Auto-runs 'git init' on first use if the folder is not a git repo yet.
  4. Commits.
  5. Publishes the repo to GitHub on first run, or pushes updates after.
  6. (Optional) Cuts a versioned GitHub Release with a downloadable zip.

  RUN (from a terminal opened in this repo folder):
    Normal update:            powershell -ExecutionPolicy Bypass -File .\publish.ps1
    Update + release v1.1.0:  powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.1.0
    With a commit message:    powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.1.0 -CommitMessage "Subject`n`nBody"

  REDO A RELEASE (the tag must not already exist on GitHub):
    gh release delete v1.1.0 --cleanup-tag --yes
    powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.1.0 -CommitMessage "..."
#>

param(
    [string]$Release = "",
    [string]$CommitMessage = "Update widget ($(Get-Date -Format 'yyyy-MM-dd'))"
)

$ErrorActionPreference = "Stop"

# ----- EDIT THESE THREE PER WIDGET -----------------------------------------
$WidgetName    = "property-report"   # widget folder name (must match EB folder + repo subfolder)
$RepoName      = "property-report-widget"
$ExbWidgetPath = "C:\arcgis-experience-builder-1.21\client\your-extensions\widgets\$WidgetName"
# ----------------------------------------------------------------------------

# Folders that live in the EB widget folder but must never ship. "Claude outputs" is the
# working folder Cowork writes deliverables and zips into. Add other scratch folders here.
$ExcludeDirs  = @("node_modules", ".vs", "Claude outputs")
$ExcludeFiles = @("*.user", "*.suo", "*.zip")

$RepoPath   = $PSScriptRoot
$WidgetDest = Join-Path $RepoPath $WidgetName

Write-Host "==> Repo:   $RepoPath"
Write-Host "==> Source: $ExbWidgetPath"

if (-not (Test-Path $ExbWidgetPath)) {
    throw "Cannot find the widget folder at:`n  $ExbWidgetPath`nEdit `$ExbWidgetPath in publish.ps1."
}

Write-Host "`n==> Syncing widget files (skipping $($ExcludeDirs -join ', '))..."
# robocopy wants each excluded name as its own argument after /XD and /XF
$xd = @("/XD") + $ExcludeDirs
$xf = @("/XF") + $ExcludeFiles
robocopy "$ExbWidgetPath" "$WidgetDest" /MIR @xd @xf /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

# /MIR leaves excluded folders alone on the destination side, so a folder that was mirrored
# before it was added to $ExcludeDirs stays in the repo until removed here.
foreach ($dir in $ExcludeDirs) {
    $stale = Join-Path $WidgetDest $dir
    if (Test-Path $stale) {
        Write-Host "    Removing excluded folder from repo copy: $dir"
        Remove-Item $stale -Recurse -Force
    }
}
Write-Host "    Done."

Push-Location $RepoPath
try {
    # Auto-initialize git on the first run so this script works on a fresh repo folder
    # without needing a separate manual "git init" beforehand.
    if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
        Write-Host "`n==> No git repository here yet. Running 'git init'..."
        git init | Out-Null
    }

    git add -A | Out-Null
    $pending = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($pending)) {
        Write-Host "`n==> No changes to commit."
    } else {
        Write-Host "`n==> Committing: $($CommitMessage.Split("`n")[0])"
        git commit -m "$CommitMessage" | Out-Null
    }

    $hasOrigin = (git remote) -contains "origin"
    $gh = Get-Command gh -ErrorAction SilentlyContinue

    if (-not $hasOrigin) {
        if ($gh) {
            Write-Host "`n==> First run: creating GitHub repo and pushing..."
            gh repo create $RepoName --public --source="." --remote="origin" --push
        } else {
            Write-Host "`n==> Repo not on GitHub yet and gh not installed. Publish once via GitHub Desktop, then re-run."
            return
        }
    } else {
        Write-Host "`n==> Pushing to GitHub..."
        git push
    }

    if ($Release -ne "") {
        if (-not $gh) {
            Write-Host "`n==> Skipping release: gh not installed. (winget install --id GitHub.cli ; gh auth login)"
        } else {
            # Fail early with a clear message instead of gh's "tag already exists"
            $existingTags = @(gh release list --limit 200 --json tagName -q ".[].tagName")
            if ($existingTags -contains $Release) {
                throw "Release $Release already exists on GitHub. Delete it first:`n  gh release delete $Release --cleanup-tag --yes`nthen run publish.ps1 again."
            }
            Write-Host "`n==> Creating release $Release ..."
            $zip = Join-Path $env:TEMP "$WidgetName.zip"
            if (Test-Path $zip) { Remove-Item $zip -Force }
            # Zip the cleaned repo copy, never the live EB folder
            Compress-Archive -Path $WidgetDest -DestinationPath $zip
            $notes = "Download $WidgetName.zip, extract, and drop the $WidgetName folder into client\your-extensions\widgets so manifest.json sits directly inside it. Then install dependencies in the client folder (npm install on Experience Builder 1.20 and earlier; pnpm install on 1.21 and later) and restart the client."
            gh release create $Release "$zip" --title "$RepoName $Release" --notes $notes
        }
    }

    Write-Host "`n==> Finished."
}
finally {
    Pop-Location
}
```

---

## 6. GitHub workflow

### One-time machine setup (already done on Brian's machine; needed only on a new machine)

- Install GitHub CLI: `winget install --id GitHub.cli`, then reopen the terminal.
- Authenticate once: `gh auth login` (GitHub.com, HTTPS, "Yes" to authenticate Git,
  login with web browser). This persists.

### Per-widget first publish

1. Build the repo folder under `Documents\GitHub\<widget-name>-widget` with the
   structure in Section 3 (widget subfolder + repo-level README/LICENSE/.gitignore/publish.ps1).
2. Edit the three variables at the top of `publish.ps1`.
3. Open a terminal in the repo folder and run:
   ```
   powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.0.0
   ```
   This auto-runs `git init`, creates the GitHub repo, pushes, and cuts release v1.0.0.

   Expect a wall of `warning: in the working copy of '<file>', LF will be replaced by
   CRLF` messages on the first commit. These are git normalizing line endings to match
   your local config and are harmless. They do not appear on subsequent runs.

### Every later update (this is the whole monthly workflow)

After changing the widget in the EB folder:

- Code update only:
  ```
  powershell -ExecutionPolicy Bypass -File .\publish.ps1
  ```
- Code update plus a new downloadable version:
  ```
  powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.1.0
  ```

No manual file copying. The script pulls from EB automatically.

### Redoing a release that shipped something it should not have

GitHub rejects a duplicate tag, so delete the release and its tag first, then publish again
with the same tag and the corrected files:

```
gh release delete v1.21.3 --cleanup-tag --yes
powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.21.3 -CommitMessage "..."
```

The commit that carried the unwanted folder stays in history. That is acceptable for scratch
output. If the folder held anything that must not remain in history, rewrite before pushing
(`git reset --soft HEAD~1`, recommit, `git push --force-with-lease`) and say so in the
CHANGELOG.

### Version tag rules

Tags must increase and never repeat (GitHub rejects duplicates).
- Bug fix: `v1.0.1`, `v1.0.2`
- New feature: `v1.1.0`, `v1.2.0`
- Major change: `v2.0.0`

### Esri Community post

- Put the GitHub repo link right under the **Overview** heading.
- The download `.zip` files stay as Esri attachments (the attachment area cannot hold a
  link). Easiest way to keep them in sync with GitHub: zip the
  `Documents\GitHub\<widget-name>-widget\<widget-name>\` folder locally (right-click,
  Send to, Compressed folder) and re-upload that as the attachment. Zip this cleaned repo
  subfolder, not the live EB widget folder, because the right-click zip ignores
  `.gitignore` and `.npmignore` (see Section 2, item 6).
- Add a dated **Changelog** line noting that the widget is now on GitHub the first time
  you publish it there.

---

## 7. Reference links

### Brian's working examples

- Property Report
  - Esri Community: https://community.esri.com/t5/experience-builder-custom-widgets/property-report-widget/bc-p/1705989
  - GitHub: https://github.com/brianmcleer/property-report-widget
  - Releases: https://github.com/brianmcleer/property-report-widget/releases
- Mailing Labels
  - Esri Community: https://community.esri.com/t5/experience-builder-custom-widgets/mailing-labels-custom-widget/ta-p/1618376
  - GitHub: https://github.com/brianmcleer/mailing-labels-widget
  - Releases: https://github.com/brianmcleer/mailing-labels-widget/releases

### Standardization discussion
- "Standardizing Custom Widget Sharing" thread: https://community.esri.com/t5/experience-builder-custom-widgets/standardizing-custom-widget-sharing/m-p/1689256#M672

### Esri documentation that backs the conventions
- Using third-party libraries (auto-install of widget deps from package.json in your-extensions):
  https://developers.arcgis.com/experience-builder/guide/third-party-libraries/
- Widget manifest (exbVersion, required fields):
  https://developers.arcgis.com/experience-builder/guide/widget-manifest/
- Manifest API reference (exbVersion enforcement note):
  https://developers.arcgis.com/experience-builder/api-reference/jimu-core/Manifest/
- EB 1.19 now on React 19 (the compatibility boundary):
  https://community.esri.com/t5/arcgis-experience-builder-blog/version-1-19-of-arcgis-experience-builder/ba-p/1667602

---

## 8. How to start the next widget (checklist)

1. Have the new widget built in `client\your-extensions\widgets\<widget-name>`.
2. Add the standardized files to it: `package.json`, `README.md`, `LICENSE`,
   `.gitignore`, `.npmignore` (see Section 2; both ignore files list `Claude outputs/`). The README must state the exact folder
   placement and include the duplicate-name troubleshooting note (Section 9). Run
   `npm install` there to create `package-lock.json` (Section 4).
   Then the Visual Studio files: copy `tsconfig.json` and `src/exb-editor-shims.d.ts` from
   the master (Section 12, item 3), add `src/runtime/esri.d.ts` if the widget uses `__esri.X`,
   add the widget to the `exclude` list in `your-extensions\widgets\tsconfig.json`, open the
   widget folder in VS, and confirm the Error List is empty for the widget's files and
   `npx tsc -p .` reports 0 errors before writing any code. Fixing this later costs more.
3. Smoke-test the widget in Experience Builder after step 2:
   - From `client`, run `npm start` and confirm webpack compiles without errors. The
     output should list `widgets/<widget-name>/dist/runtime/widget` and
     `widgets/<widget-name>/dist/setting/setting` in the Entrypoint summary.
   - Open the builder, drop the widget into an experience, and check the browser
     console for errors.
   - Exercise the settings panel: click through every section, confirm controls render,
     and (for widgets with XML import/export) round-trip a configuration.
   - Exercise at least one feature path per upgraded or newly added dependency. For
     widgets with `jspdf`, click PDF export and confirm a file downloads and opens.
     For `@tanstack/react-table`, render a table and sort a column. For `recharts`,
     render a chart. Webpack compilation alone does not catch runtime API mismatches.
4. Create the repo folder `Documents\GitHub\<widget-name>-widget` with the layout in
   Section 3, including a repo-level README/LICENSE/.gitignore and `publish.ps1` with the
   three variables edited.
5. Run `publish.ps1 -Release v1.0.0`. The script auto-runs `git init` if needed, creates
   the GitHub repo, pushes everything, and cuts the v1.0.0 release.
6. Update the Esri Community post: add the GitHub link under Overview, post a changelog
   entry, and re-upload the zip from `Documents\GitHub\<widget-name>-widget\<widget-name>\`
   so the Community attachment stays in sync with the GitHub release.
7. Add the in-widget help guide (Section 10) before calling the widget done. A widget
   with a Help button gets far fewer "how do I" emails than one with a README nobody opens.
   Do it by **copying** from the reference widget, not by writing it fresh:
   - Copy `src/runtime/theme.ts` and `src/runtime/components/HelpPopup.tsx` unchanged.
   - Write only `src/runtime/helpSections.ts` and the `help*` strings for this widget.
   - Add the Help button and the first-run hint with the markup in Section 10.5, verbatim.
   - Add the widget to the `WIDGETS` list in the consistency suite (Section 10.9) and run it.
   A new widget should reach a working guide in an hour or two. If it is taking longer, the
   presentation is being rewritten when it should be copied.

   Then run the runtime checklist in Section 11 (theme tokens, aria-live, wrapping toolbars)
   and the EB 1.21 gotchas in Section 12 (no `esri/*` imports under `src/setting/`).
8. A few minutes after the first publish, open the repo's Dependabot alerts page
   (`https://github.com/brianmcleer/<widget-name>-widget/security/dependabot`). If it flags a
   transitive CVE such as `dompurify`, apply the fix in the EB source folder and re-publish,
   following Section 4, "Fixing Dependabot alerts". Do not patch the repo directly; `/MIR`
   reverts it.

### Style note
Do not use em dashes in any writing for Brian.

---

## 9. Troubleshooting reference: `<name> is duplicated`

This is the most common downstream install failure, so it lives here once and gets a short
version in every widget README (Section 2, item 4).

**What it means.** When you run `npm start` in the `client` folder, Experience Builder
scans `your-extensions/widgets` and registers each widget by the `name` value in its
`manifest.json`. It throws `<name> is duplicated` when the same name is registered more
than once. A single, correctly placed copy cannot duplicate itself, so a second copy is
present somewhere in the install. Replacing just the one widget folder does not fix it,
because the other copy is still there.

**Where the second copy hides, check in this order:**
1. A nested folder: `widgets\<widget-name>\<widget-name>`. The manifest must sit directly
   inside the widget folder, not a second level deep. This is the usual culprit when a zip
   is extracted into a folder that already has the widget's name.
2. A leftover folder from an earlier build or version, including any `-copy` folder, or a
   folder under the widget's previous name if it was renamed.
3. A stale compiled build in `client\dist\widgets`. Stop the client server, delete the
   matching folder under `dist\widgets` (or run a clean build), then start again. This is
   the common cause after moving a widget between EB versions, because the build can see
   both the new source and the old compiled output.

**Tell for the nesting case:** if removing one copy makes the widget disappear from the
Entrypoint list entirely, the copy that remains is nested too deep. Move it so the manifest
is directly inside the widget folder.

This surfaced on the Basemap Gallery Custom thread, where a user hit it migrating a widget
from EB 1.19 to 1.20:
https://community.esri.com/t5/experience-builder-custom-widgets/basemap-gallery-custom-widget/ba-p/1676397

---

## 10. In-widget help guide (the pattern to reuse on every widget)

Droplets shipped a Help button in its header that opens a short, searchable, plain-language
guide. Users who dislike technology could follow it, and it adapts to whatever the builder has
turned on, so nobody reads about a feature their app does not have. This section is the whole
pattern: files, code, exact visual spec, writing rules. Copy it into the next widget.

**Droplets is the reference implementation.** When this document and the Droplets source
disagree, the Droplets source wins and this document is wrong; fix it. Print Advanced is the
second widget on the pattern and matches it.

**Do not improvise on the presentation.** The point of the pattern is that a user who has
learned the guide in one widget already knows it in every other one: same button, same place,
same modal, same accordion, same words for Help and Close. `HelpPopup.tsx` and `theme.ts` are
copied between widgets unchanged. The only file you write per widget is `helpSections.ts`.

### 10.1 How it behaves

- A **Help** button (Calcite `question` icon, icon only) sits at the right of the widget
  header. It opens a small centered jimu-ui `Modal`.
- The modal has a one-paragraph intro, a **search box**, and an **accordion** of sections. One
  section is open at a time (opening another closes the last), so the guide never grows past
  the screen. The modal body still caps at `70vh` and scrolls as a safety net.
- Search keeps only the lines that contain the typed word, highlights the match, and opens the
  first matching section by itself. A section whose title matches keeps all its lines.
- Every line is **gated on a feature flag**. The widget computes a `features` object from its
  config and live status and passes it in; lines about a feature that is off are simply not
  built. Lists inside sentences ("share, export and delete") are assembled from the enabled
  parts too.
- A **first-run hint** (a tinted banner on the main view with an "Open the guide" link) shows
  until the user dismisses it once. The dismissal is stored per browser.
- All text lives in `translations/default.ts` so it can be localized with the rest of the UI.

### 10.2 Files

```
src/runtime/theme.ts                   <- useTokens(); copy between widgets unchanged (Section 11.2)
src/runtime/components/HelpPopup.tsx   <- presentation: modal, search, accordion; copy unchanged
src/runtime/helpSections.ts            <- content: builds the sections for THIS widget from flags
src/runtime/translations/default.ts    <- every help string, keys prefixed help*
```

Keep presentation and content apart. `HelpPopup.tsx` is identical across widgets;
`helpSections.ts` is the only file that changes per widget.

### 10.3 HelpPopup.tsx (generic, copy verbatim)

Requires `useTokens()` from Section 11.2. Nothing here needs a `package.json` entry: `jimu-ui`
(including the whole `Modal` family), `calcite-components` and `jimu-theme` are all supplied by
Experience Builder. See "What belongs in `package.json`" in Section 2.

Strings are **passed in as props** rather than read from `useIntl()` inside the component. That
is deliberate: it makes the same file work whether the parent widget is a function component
with `useIntl` (Droplets) or a class component reading `defaultMessages` directly (Print
Advanced). Sections are passed in for the same reason, which is what keeps the file free of any
widget-specific copy.

```tsx
import { React } from 'jimu-core'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, TextInput } from 'jimu-ui'
import { CalciteIcon } from 'calcite-components'
import { useTokens } from '../theme'

const { useState, useEffect } = React

export interface HelpSection {
  /** Stable key: search behavior and the opening section depend on it. Use the standard
   *  keys from 10.6 so search behaves the same way across widgets. */
  key: string
  /** Calcite icon name, e.g. 'play', 'save', 'map', 'ellipsis', 'share', 'search',
   *  'folder', 'exclamation-mark-triangle', 'lightbulb'. */
  icon: string
  title: string
  /** Optional sentence above the list, in the section's own words. */
  intro?: string
  body: string[]
  /** Numbered steps instead of bullets. Start here only. */
  ordered?: boolean
}

export interface HelpPopupProps {
  open: boolean
  onClose: () => void
  /** Built per widget in helpSections.ts from translations plus feature flags. */
  sections: HelpSection[]
  /** Key of the section open when the guide first shows. */
  initialKey?: string
  title: string
  intro: string
  searchPlaceholder: string
  noMatches: string
  closeLabel: string
}

const HelpPopup: React.FC<HelpPopupProps> = ({
  open, onClose, sections, initialKey = 'start',
  title, intro, searchPlaceholder, noMatches, closeLabel
}) => {
  const tokens = useTokens()
  // One section open at a time, so the guide never grows past the screen.
  const [openKey, setOpenKey] = useState<string>(initialKey)
  const [query, setQuery] = useState('')

  // Search: keep only lines that mention the word; a section whose title matches keeps all lines.
  const needle = query.trim().toLowerCase()
  const visible: HelpSection[] = needle
    ? sections
      .map((s: HelpSection): HelpSection => {
        if (s.title.toLowerCase().includes(needle)) return s
        const secIntro = s.intro && s.intro.toLowerCase().includes(needle) ? s.intro : undefined
        return { ...s, intro: secIntro, body: s.body.filter((line: string) => line.toLowerCase().includes(needle)) }
      })
      .filter((s: HelpSection) => s.body.length > 0 || !!s.intro)
    : sections

  // While searching, the first matching section opens so the hit is visible without a click.
  useEffect(() => {
    if (needle && visible.length > 0 && !visible.some((s: HelpSection) => s.key === openKey)) setOpenKey(visible[0].key)
  }, [needle]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reopening the guide starts fresh, so a word typed last time is not still filtering.
  useEffect(() => {
    if (open) { setQuery(''); setOpenKey(initialKey) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const toggle = (key: string): void => { setOpenKey(openKey === key ? '' : key) }

  const highlight = (line: string): React.ReactNode => {
    if (!needle) return line
    const at = line.toLowerCase().indexOf(needle)
    if (at < 0) return line
    return (
      <React.Fragment>
        {line.slice(0, at)}
        <mark style={{ background: tokens.infoBg, color: tokens.text, padding: '0 1px', borderRadius: '2px' }}>{line.slice(at, at + needle.length)}</mark>
        {line.slice(at + needle.length)}
      </React.Fragment>
    )
  }

  return (
    <Modal isOpen centered toggle={onClose} size="sm">
      <ModalHeader toggle={onClose}>{title}</ModalHeader>
      {/* Scrolls as a safety net on very short screens; the accordion keeps it short normally. */}
      <ModalBody style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: tokens.text, lineHeight: 1.55 }}>{intro}</p>

        <div style={{ marginBottom: '10px' }}>
          <TextInput
            type="text"
            size="sm"
            allowClear
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setQuery(e.target.value) }}
          />
        </div>

        {visible.length === 0 && (
          <p style={{ margin: 0, fontSize: '13px', color: tokens.textSecondary }}>{noMatches}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visible.map((s: HelpSection) => {
            const isOpen = openKey === s.key
            const ListTag: any = s.ordered ? 'ol' : 'ul'
            return (
              <div key={s.key} style={{ border: `1px solid ${isOpen ? tokens.primary : tokens.divider}`, borderRadius: tokens.radius, overflow: 'hidden' }}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => { toggle(s.key) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: isOpen ? tokens.infoBg : tokens.surface, color: tokens.text, cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  <span style={{ color: tokens.primary, display: 'flex' }} aria-hidden="true"><CalciteIcon icon={s.icon} scale="s" /></span>
                  <span style={{ flex: 1 }}>{highlight(s.title)}</span>
                  <CalciteIcon icon={isOpen ? 'chevron-up' : 'chevron-down'} scale="s" />
                </button>
                {isOpen && (
                  <div style={{ padding: '8px 12px 10px 12px', fontSize: '13px', lineHeight: 1.6, color: tokens.text }}>
                    {s.intro && <p style={{ margin: '0 0 6px 0', color: tokens.textSecondary }}>{highlight(s.intro)}</p>}
                    {s.body.length > 0 && (
                      <ListTag style={{ margin: 0, paddingLeft: '20px' }}>
                        {s.body.map((line: string, i: number) => <li key={i} style={{ marginBottom: '6px' }}>{highlight(line)}</li>)}
                      </ListTag>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="primary" onClick={onClose}>{closeLabel}</Button>
      </ModalFooter>
    </Modal>
  )
}

export default HelpPopup
```

### 10.4 The visual spec (what "consistent" actually means)

Numbers, not adjectives. Every one of these is in the code above; they are listed separately so
a review can check a new widget against them, and so a future change is made in all widgets at
once rather than drifting in one.

| Element | Spec |
|---|---|
| Container | `Modal` with `isOpen centered size="sm"`, `toggle={onClose}` |
| Header | `ModalHeader toggle={onClose}`, text is the shared word for Help |
| Body | `maxHeight: '70vh'`, `overflowY: 'auto'` |
| Footer | `ModalFooter` with one `Button type="primary"`, the shared word for Close |
| Intro paragraph | `13px`, `lineHeight 1.55`, `margin 0 0 12px 0`, `color tokens.text` |
| Search box | `TextInput type="text" size="sm" allowClear`, wrapper `marginBottom 10px`, `aria-label` same as placeholder |
| No-match line | `13px`, `color tokens.textSecondary`, no margin |
| Accordion | flex column, `gap 6px` |
| Section shell | `1px` border, `tokens.primary` when open else `tokens.divider`, `borderRadius tokens.radius`, `overflow hidden` |
| Section header | `<button>`, `padding 9px 10px`, `13px`, `fontWeight 600`, `gap 8px`, `border none`, background `tokens.infoBg` when open else `tokens.surface`, `aria-expanded` |
| Section icon | `CalciteIcon scale="s"` in `tokens.primary`, wrapper `aria-hidden` |
| Chevron | `CalciteIcon` `chevron-up` when open, `chevron-down` when closed, `scale="s"` |
| Section panel | `padding 8px 12px 10px 12px`, `13px`, `lineHeight 1.6`, `color tokens.text` |
| Section intro | `margin 0 0 6px 0`, `color tokens.textSecondary` |
| List | `ul` or `ol` per `ordered`, `margin 0`, `paddingLeft 20px`, each `li` `marginBottom 6px` |
| Search highlight | `<mark>` `background tokens.infoBg`, `color tokens.text`, `padding 0 1px`, `borderRadius 2px` |

**No hardcoded colors anywhere in the guide.** Every color is a `tokens.*` read. A hex literal
in `HelpPopup.tsx` is a bug.

**Shared translation keys.** Same key names, same wording, in every widget. Only `helpIntro`
and `firstRunBody` are widget-specific, and even those follow the same shape.

| Key | Value |
|---|---|
| `helpTitle` | `Help` (exactly this, in every widget) |
| `close` | `Close` |
| `helpIntro` | One sentence saying what the widget is for, in the user's terms |
| `helpSearchPlaceholder` | `Search the guide (try "x" or "y")`, with two words a real user would type |
| `helpNoMatches` | `Nothing in the guide matches that word. Try another, or open the sections above.` |
| `helpAnd` | `and`, used by `listOf` |
| `firstRunTitle` | `New here?` |
| `firstRunBody` | The happy path in one sentence |
| `firstRunHelpLink` | `Open the guide.` |

### 10.5 Wiring it into widget.tsx

**The Help button** goes at the right of the widget header, icon only, `size="sm"
type="tertiary" icon`, with `title` and `aria-label` both set to the Help string:

```tsx
<Button size="sm" type="tertiary" icon onClick={onHelp} title={t('helpTitle')} aria-label={t('helpTitle')} style={{ flexShrink: 0 }}>
  <CalciteIcon icon="question" scale="s" />
</Button>
```

In Droplets it sits beside the `Tabs` in `Navbar.tsx`; in Print Advanced, which has no tabs, it
sits in a small right-aligned header row above the scrolling options. Either way it is the
top-right of the widget.

**The modal** goes anywhere in the tree:

```tsx
<HelpPopup
  open={helpOpen}
  onClose={() => { setHelpOpen(false) }}
  sections={buildHelpSections(tt, features)}
  title={t('helpTitle')}
  intro={t('helpIntro')}
  searchPlaceholder={t('helpSearchPlaceholder')}
  noMatches={t('helpNoMatches')}
  closeLabel={t('close')}
/>
```

**The first-run hint** is a banner on the main view, shown until dismissed once. Use the
Section 11.2 banner recipe: tinted background, a 3px accent bar on the left, a lightbulb, a
bold lead-in on its own line, the sentence, an inline underlined link into the guide, and an
icon-only `x` dismiss on the right.

```tsx
{showFirstRunHint && (
  <div role="note" style={{ margin: '0 14px 10px 14px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: '10px', background: tokens.infoBg, color: tokens.text, border: `1px solid ${tokens.divider}`, borderLeft: `3px solid ${tokens.primary}`, borderRadius: tokens.radius, fontSize: '12px', lineHeight: 1.5 }}>
    <span style={{ color: tokens.primary, marginTop: '1px' }} aria-hidden="true"><CalciteIcon icon="lightbulb" scale="s" /></span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <strong style={{ display: 'block', marginBottom: '2px' }}>{t('firstRunTitle')}</strong>
      {t('firstRunBody')}
      {' '}
      <button type="button" onClick={onOpenHelp} style={{ border: 'none', background: 'transparent', padding: 0, color: tokens.primary, cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}>{t('firstRunHelpLink')}</button>
    </span>
    <Button size="sm" type="tertiary" icon onClick={onDismissHint} title={t('firstRunDismiss')} aria-label={t('firstRunDismiss')}>
      <CalciteIcon icon="x" scale="s" />
    </Button>
  </div>
)}
```

Persist the dismissal per browser, and **namespace it by widget id** so two copies of the same
widget in one app do not share a dismissal. Droplets uses its IndexedDB settings row
(`helpHintDismissed`); Print Advanced, which has no store, uses `localStorage` under
`printAdvanced.helpHintDismissed.<widgetId>`. Wrap the read and the write in try/catch: private
browsing throws on both, and the guide is not worth breaking a widget over.

Opening the guide counts as answering the hint, so `openHelp()` also dismisses it.

### 10.6 helpSections.ts (per widget)

One exported function. It takes a translate function and the feature flags, and returns the
sections. `when(flag, ...keys)` is the whole gating mechanism; `listOf` builds "a, b and c"
from the enabled parts.

```ts
import type { HelpSection } from './components/HelpPopup'

/** Flags the widget computes from config and live status. One per feature that has help text. */
export interface HelpFeatures {
  exportEnabled: boolean
  sharing: boolean
  // add one boolean per optional feature
}

type T = (id: string, values?: Record<string, string>) => string

export function buildHelpSections (t: T, f: HelpFeatures): HelpSection[] {
  const when = (on: boolean, ...ids: string[]): string[] => (on ? ids.map((id: string) => t(id)) : [])
  const listOf = (parts: string[]): string =>
    parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} ${t('helpAnd')} ${parts[parts.length - 1]}`

  const bulkActions = listOf([...(f.sharing ? [t('helpBulkShare')] : []), ...(f.exportEnabled ? [t('helpBulkExport')] : []), t('helpBulkDelete')])

  return [
    { key: 'start', icon: 'play', title: t('helpStartTitle'), ordered: true, body: [t('helpStart1'), t('helpStart2'), t('helpStart3')] },
    { key: 'menu', icon: 'ellipsis', title: t('helpMenuTitle'), intro: t('helpMenuIntro'), body: [t('helpMenuA'), ...when(f.exportEnabled, 'helpMenuExport'), t('helpMenuDelete')] },
    ...(f.sharing ? [{ key: 'share', icon: 'share', title: t('helpShareTitle'), body: [t('helpShare1'), t('helpShare2')] }] : []),
    { key: 'organize', icon: 'search', title: t('helpOrganizeTitle'), body: [t('helpOrganize1'), t('helpOrganize2', { actions: bulkActions })] },
    { key: 'trouble', icon: 'exclamation-mark-triangle', title: t('helpTroubleTitle'), body: [t('helpTrouble1'), t('helpTrouble2'), t('helpTroubleContact')] },
    { key: 'tips', icon: 'lightbulb', title: t('helpTipsTitle'), body: [t('helpTips1')] }
  ]
}
```

**Compute the flags from the same checks the UI itself uses**, not from a separate reading of
the config. That is what stops the guide describing a control the widget is not currently
showing. Print Advanced's `helpFeatures()` calls its own `ctrl()`, `meEnabled()`,
`meMapOnly()`, `outSREnabled()` and `printSource()` helpers for exactly this reason.

### 10.7 Standard section set

Use these in this order. Drop the ones a widget has no content for; keep the keys stable so
search behavior is predictable across widgets. Only `start` is ever `ordered`.

| key | icon | title | what goes in it |
|---|---|---|---|
| `start` | `play` | Start here: three steps | Numbered. The one happy path, nothing else. |
| `save` / `do` | `save` | Saving and updating (or the widget's main verb) | Rules the user hits every time: unique names, what overwrite means. |
| `load` / `use` | `map` | Bringing it back (or using the result) | What happens on click, what to wait for, what is skipped. |
| `menu` | `ellipsis` | The card menu, button by button | Every menu item, `Label: what it does.` Same label text as the UI. |
| `share` | `share` | Sharing with colleagues | Who sees what, what they must do (usually nothing). |
| `organize` | `search` | Finding what you saved | Search, sort, tags, bulk select. |
| `keep` | `folder` | Where things live | Browser vs folder vs portal, what clearing browser data does. |
| `trouble` | `exclamation-mark-triangle` | If something looks wrong | Symptom: cause and what to do. End with who to contact. |
| `tips` | `lightbulb` | Good to know | Two or three short lines. |

A widget with a different shape adds its own sections between `start` and `trouble`, keeping
`start` first and `trouble` then `tips` last. Print Advanced adds `area` (`map`), `parts`
(`list-check`), `select` (`cursor-marquee`), `format` (`file`), `geo` (`globe`), `series`
(`grid-unit`) and `results` (`download`). Give each section a distinct icon.

### 10.8 Writing rules for the text

1. Write for someone who would rather not be using a computer. Short sentences, common words,
   one idea per line. No "instance", "session", "persist", "sync", "toggle", "modal".
2. Name buttons exactly as the interface shows them, in the same capitalization: `Overwrite`,
   `Share...`, `Select several`. If the button says "Tags..." the guide says "Tags...".
3. Say where a thing is: "in the card menu, the three dots", "on the Settings tab", "the box at
   the top".
4. Tell the user what to expect and how long to wait: "A blue bar runs across it while the map
   redraws; give it a moment."
5. Troubleshooting lines follow one shape: `Symptom: cause. What to do.`
6. Numbered steps only in Start here. Bullets everywhere else.
7. Never mention a feature behind a flag that is off. If a sentence contains a list of
   features, build it with `listOf` from the enabled parts.
8. The last troubleshooting line is always "Still stuck? Contact the GIS Division and mention
   the <widget> name and this app."
9. No em dashes. Use a colon, a comma or a new sentence.
10. Keep the intro to one sentence saying what the widget is for, in the user's terms.

### 10.9 Test the guide, do not just eyeball it

Most of these rules are mechanically checkable, and a test is cheaper than a review. Print
Advanced ships two suites over `buildHelpSections`, run the way Section 14 describes:

- **Content, 64 assertions.** Every string resolves and no `{token}` is left unfilled. Feature
  gating in both directions: all flags on, all flags off, then one flag at a time, asserting
  the section appears and that the words for the off features are absent from the whole guide.
  `listOf` produces "a", "a and b", "a, b and c". Section order, unique keys, distinct icons.
  Search finds the words a real user would type. Then the writing rules from 10.8 as
  assertions: no em or en dashes anywhere, no banned jargon word, only `start` is `ordered`,
  every troubleshooting line has a `Symptom:` colon and ends in a full stop, the contact line
  is last and matches verbatim, and every UI control name appears in the guide exactly as the
  translations spell it. That last one is the useful one: it fails the moment somebody renames
  a button and forgets the guide.
- **Cross-widget consistency, 88 assertions.** Reads Droplets and the widget under test side by
  side and asserts every row of the 10.4 spec appears in both, that `theme.ts` is byte-identical
  to the reference, that the guide contains no hex color and no inline `<svg>`, that the shared
  translation keys all exist with the same `helpTitle` value and the placeholder shape, and that
  the Help button and first-run hint markup match. It checks the reference against the spec
  first, so a wrong spec fails loudly instead of quietly passing everything.

Add each new widget to the `WIDGETS` list in the consistency suite. That is what keeps this
section honest as the family grows.

### 10.10 Property Report on the pattern (September 2026)

Property Report is the third widget on the pattern and the first with a search box rather
than cards, so its section set is the standard one with `find`, `read`, `map` and `export`
between `start` and `trouble`. Files, all in `src/runtime/`: `theme.ts` (byte copy of
Droplets), `components/HelpPopup.tsx` (the 10.3 generic component), `helpSections.ts`,
and the `help*` and `firstRun*` keys in `translations/default.ts`. The Help button sits at
the right end of the search row; the first-run hint shows on the empty results view until
dismissed and is stored under `propertyReport.helpHintDismissed.<widgetId>`.

`HelpFeatures` for this widget, each computed from the same config check the UI uses:

| Flag | Computed from | Gates |
|---|---|---|
| `mapConnected` | `config.mapWidgetId` | map click line, the whole `map` section |
| `currentLocation` | `enableUseCurrentLocation !== false` | location line, location troubleshooting |
| `recentSearches` | `enableRecentSearches !== false` | recent searches line |
| `tables` / `charts` | any section `displayAsTable` / `displayAsChart` | table and chart reading lines |
| `nearby` / `relatedTables` / `separatePane` | any layer `nearbyConfig.enabled` / `relatedTables` / `displayPane === 'separate'` | the matching reading lines |
| `coordinates` | `showCoordinates !== false` | coordinates line |
| `rowHighlight` / `rowZoom` / `showAllOnMap` | any layer with the flag | map section lines |
| `propertyPreview` | `propertyPreview.enabled` | preview map line |
| `csvExport` / `permalink` / `comparison` | `enableCsvExport` / `enablePermalink` / `enableComparison` `!== false` | export and share lines, one tip |

Two notes for whoever writes the next `helpSections.ts`. First, the `trouble` section here
carries a line for the PDF export ("shows an error or nothing happens: the PDF tools did not
load. Reload the page and try again.") because that failure reached users in September 2026
(Section 12, item 8). Write the troubleshooting line for a failure at the same time as the
fix. Second, the `map` section is dropped entirely when there is no map widget, not just
emptied: an empty section with a heading is worse than none.

## 11. Runtime UI conventions (jimu-ui, Calcite, theme tokens, accessibility)

### 11.1 Components

- Build on **jimu-ui** (`Button`, `TextInput`, `Select`, `Option`, `Switch`, `Checkbox`,
  `Modal` and its `ModalHeader` / `ModalBody` / `ModalFooter`, `Tabs`, `Tab`, `Alert`,
  `Tooltip`, `Dropdown`) and **Calcite** wrappers from `calcite-components` (`CalciteIcon`,
  `CalciteChip`). Do not hand-roll buttons, inputs, dialogs or icons. All of these are
  supplied by Experience Builder and must not appear in `package.json`; see Section 2.
  Hand-rolling one of these is how two widgets end up looking like two products. Section 10
  is the worked example: the help guide is a `Modal` with `CalciteIcon`s and nothing else.
- `Tab` requires children in EB 1.21; pass `<></>` when the tab has no inline content.
- Icon buttons always get `title` and `aria-label` with the same text.
- Chips (`CalciteChip scale="s"`) for status and tags; `kind="brand"` for the active one.

### 11.2 Theme tokens (theme.ts)

Never hard-code colors. Read them from the Experience's theme so the widget follows the app's
colors and light/dark mode. Put this in `src/runtime/theme.ts` and use `useTokens()` in every
component.

**This file is copied between widgets unchanged.** It is the single source of the family's
colors, radii and shadows, so a widget that edits it drifts away from the others. The
consistency suite in Section 10.9 asserts it is byte-identical to the reference. A class
component cannot call the hook itself; have it render a small function component (as the help
guide does) rather than reimplementing the tokens with CSS variables.

```ts
import { useTheme } from 'jimu-theme'

export interface Tokens {
  primary: string; primaryText: string; surface: string; background: string
  text: string; textSecondary: string; divider: string; danger: string
  warning: string; warningBg: string; info: string; infoBg: string
  radius: string; radiusLg: string; shadow: string; shadowHover: string
}

/** A faint tint of `color` over `base`, for banner backgrounds. See the contrast note below. */
function tint (color: string, percent: number, base: string): string {
  if (typeof CSS !== 'undefined' && typeof (CSS as any).supports === 'function' && (CSS as any).supports('color', 'color-mix(in srgb, red 10%, white)')) {
    return `color-mix(in srgb, ${color} ${percent}%, ${base})`
  }
  return base
}

export function useTokens (): Tokens {
  const theme: any = useTheme()
  const sys = theme?.sys ?? {}
  const color = sys.color ?? {}
  const primary: string = color.primary?.main ?? '#0079c1'
  const surface: string = color.surface?.paper ?? '#ffffff'
  const warning: string = color.warning?.main ?? '#8a6100'
  return {
    primary,
    primaryText: color.primary?.text ?? '#ffffff',
    surface,
    background: color.surface?.background ?? '#f7f8fa',
    text: color.surface?.paperText ?? '#1b1f24',
    textSecondary: color.surface?.paperHint ?? '#5a6572',
    divider: color.divider?.secondary ?? color.divider?.primary ?? '#e1e5e9',
    danger: color.error?.main ?? '#d64545',
    warning,
    warningBg: tint(warning, 14, surface),
    info: color.info?.main ?? primary,
    infoBg: tint(primary, 10, surface),
    radius: sys.shape?.shape1 ?? '4px',
    radiusLg: sys.shape?.shape2 ?? '8px',
    shadow: sys.shadow?.shadow1 ?? '0 1px 3px rgba(0,0,0,0.10)',
    shadowHover: sys.shadow?.shadow2 ?? '0 6px 16px rgba(0,0,0,0.14)'
  }
}
```

**Contrast lesson.** Do not use a theme's `info.light` / `primary.light` as a banner
background. Some Experience themes define "light" as a saturated color, which gave dark text
on medium blue and a complaint from a user. Tint the primary into the surface color with
`color-mix` (10 to 14 percent) and always set the banner's text color explicitly to
`tokens.text`. Banner recipe: `background: tokens.infoBg, color: tokens.text, borderLeft:
3px solid tokens.primary, borderRadius: tokens.radius`.

### 11.3 Layout rules that came from real bugs

- A toolbar with text plus several buttons must be **two rows** (label row, then a wrapping
  button row), not one flex row. One row with `flex: 1` on the label crushes the label to zero
  width and paints the buttons over it at narrow widget sizes. Put `marginLeft: 'auto'` on the
  Cancel button of the second row.
- Anything that lists sections or cards inside a modal is an **accordion** (one open at a
  time) or scrolls inside `maxHeight: '70vh'`. Never let a modal grow past the viewport.
- Wide content (tables, code) scrolls inside its own `overflowX: 'auto'` box.

### 11.4 Accessibility baseline (do all of these)

- One polite live region for results: `<div role="status" aria-live="polite" aria-atomic="true">`
  visually hidden, set to the latest message (saved, deleted, error). Every `alert()` in the
  widget also writes to it.
- Cards: full `aria-label` (name plus author), `aria-busy` while loading, `aria-pressed` in
  select mode, visible focus ring.
- Toggle chips are `<button aria-pressed>`; lists of things are `<section aria-label>`; a bulk
  bar is `role="toolbar"`; a status bar is `role="status"`.
- Every input has a label; every icon button has `aria-label`.
- Checkboxes wrap in a `<label>` with their text so the text is clickable.

---

## 12. EB 1.21 / Maps SDK 5.x gotchas (each cost real time)

1. **Blank settings panel in Developer Edition.** Nothing under `src/setting/` may import
   `esri/*`, directly or through a shared service. The settings bundle loads in the builder,
   which has no map, and a static esri import fails the whole bundle silently. Need the SDK in
   settings (for example a "Test connection" button)? Use
   `loadArcGISJSAPIModules(['esri/portal/Portal'])` from `jimu-arcgis` at click time. Rule of
   thumb: runtime services that import esri are never imported by setting.tsx; put shared
   pure helpers in a module with no esri imports.
2. **Endless spinner, `scriptError ... esri/TimeExtent.js` in the console.** EB 1.21 runs Maps
   SDK 5.1, where several modules moved: `esri/TimeExtent` is `esri/time/TimeExtent`,
   `esri/geometry/projection` is `esri/geometry/operators/projectOperator`. One wrong esri path
   fails the entire widget bundle at load. Check import paths against the 5.x reference when
   porting anything older.
3. **Visual Studio errors that webpack does not have.** Webpack (`npm start` in `client`) is
   the only type authority. Visual Studio's Error List is a separate, IDE-only analysis, and on
   EB 1.21 (pnpm) it is wrong by default. Every widget gets a widget-level `tsconfig.json`
   (next to `manifest.json`, `noEmit`, inert to the build) plus type-only `.d.ts` shims.
   There are two modes; pick by running this test first:

   **The test.** Open the widget folder in VS and look for `IDE1100 "Access to the path ...
   client\node_modules\... is denied"` in the Error List. If it appears, VS cannot read
   anything under `client\node_modules` (the pnpm junctions) and only mode B works. If it
   does not appear, mode A works and gives real jimu/esri types.

   **Mode A, paths (VS can read node_modules).** `tsconfig.json` with `baseUrl: "../../.."`
   and `paths` for `jimu-*` (to `jimu-*`), `esri/*` (to `node_modules/@arcgis/core/*`),
   `react`, `react-dom`, `seamless-immutable`, `calcite-components`
   (`jimu-ui/calcite-components`); `src/exb-editor-shims.d.ts` declaring
   `@emotion/react/jsx-runtime` (re-export `react/jsx-runtime`) and each `esri/*` module you
   import. Type widget props as `AllWidgetProps<IMConfig> & { id: string, useMapWidgetIds?:
   string[], stateProps?: ... }` because `id` and `useMapWidgetIds` are missing from the
   pnpm-resolved typings. This was the property-report and Droplets setup. Never set
   `preserveSymlinks` or `moduleResolution: "bundler"` (both produce TS2306 "is not a
   module" on the junctioned `.d.ts` files).

   **Mode B, self-contained (VS reports IDE1100 on node_modules; the September 2026 state
   of Brian's install).** No `baseUrl`, no `paths`, `"types": []`, `strict: false`,
   `skipLibCheck: true`, `lib: ["ESNext", "DOM", "DOM.Iterable"]`, classic `jsx: "react"`
   (no `jsxImportSource`; see the jsx-runtime access-denied trap below for why not
   `react-jsx`), `include: ["src/**/*.ts", "src/**/*.tsx",
   "src/**/*.d.ts"]`. Everything the widget imports (`react`, `react/jsx-runtime`,
   `@emotion/react/jsx-runtime`, `jimu-core`, `jimu-arcgis`, `jimu-ui`, `jimu-theme`,
   `esri/*`, `@esri/*`, `seamless-immutable`) is declared ambiently in
   `src/exb-editor-shims.d.ts` (about 20 KB; React's Component/PureComponent, events, CSS
   types are declared closely enough to type-check real props and state; jimu members not
   listed are `any`). `__esri.X` references resolve through `src/runtime/esri.d.ts`, a
   `declare global { namespace __esri { interface X { [key: string]: any } } }` block with
   one open interface per member the widget uses (open interfaces merge with the real
   `@arcgis/core` types if they ever load; `type X = any` would collide as TS2300). Add an
   interface there when a new `__esri.Y` shows TS2694. The master copies live at
   `client\your-extensions\widgets\_vs\exb-editor-shims.d.ts` and in the
   report-a-concern-submit widget; copy, do not rewrite. Verified: `npx tsc -p .` in the
   widget folder reports 0 errors with TypeScript 5.6 and 6.0 (with 6.x add
   `--ignoreDeprecations 6.0` for `moduleResolution: "Node"`).

   **The jsx-runtime access-denied trap (Enhanced Measurement 1.2.1, September 2026).** Mode
   B originally set `jsx: "react-jsx"` with `jsxImportSource: "@emotion/react"`. That is not
   safe on a pnpm install where Visual Studio can partly read `client\node_modules`:
   `react-jsx` makes VS resolve `@emotion/react/jsx-runtime`, the real package resolves far
   enough to chase its transitive `@types/react/jsx-runtime.d.ts`, and reading that file
   through the pnpm junction throws `Error reading content of source file
   '...client\node_modules\@types\react\jsx-runtime.d.ts' -- 'Access to the path ... is
   denied.'`. An ambient `declare module '@emotion/react/jsx-runtime'` in the shim does not
   save you, because a resolvable real module beats an ambient declaration. It bites the
   moment a widget has any `.tsx` file without the `/** @jsx jsx */` pragma, and the
   help-guide pattern ships two of them into every widget (`HelpPopup.tsx` and
   `FirstRunHint.tsx`, Section 10.3, both import `React` from `jimu-core` with no pragma).
   The fix, now the mode B default: classic `jsx: "react"` and no `jsxImportSource`. Classic
   JSX never resolves a jsx-runtime module, so the denied file is never read, whatever state
   `node_modules` is in. Add one top-level `declare namespace JSX { type Element = any;
   interface IntrinsicElements { [k: string]: any }; interface ElementClass { render (): any
   }; interface ElementAttributesProperty { props: {} }; interface ElementChildrenAttribute {
   children: {} }; interface IntrinsicAttributes { [k: string]: any } }` to
   `src/exb-editor-shims.d.ts` (a plain `declare namespace` with no `import`/`export`, so the
   file stays a script and its `declare module` blocks stay ambient) so classic mode still
   type-checks elements as `any`. Pragma files emit through `jsx` from `jimu-core`; the two
   pragma-less help files fall back to `React.createElement`/`React.Fragment`, both in scope
   from the `jimu-core` React import. Webpack is unaffected either way (it reads the `@jsx
   jsx` pragma per file). Push the fix into the masters so copies inherit it: add the global
   JSX block to `widgets\_vs\exb-editor-shims.d.ts`, and set `jsx: "react"` in
   `widgets\tsconfig.json` (the folder catch-all) and any master tsconfig. Mode A keeps
   `react-jsx`, because there VS reads all of `node_modules` and the runtime resolves cleanly.
   Verified on Enhanced Measurement: `npx tsc -p .` reports 0 errors with TypeScript 5.6.

   **The `@arcgis/core/*` access-denied trap (Search Custom, September 2026).** Same mechanism
   as the jsx-runtime trap, different package. Mode B declares the Maps SDK modules ambiently,
   but `@arcgis/core` is a real installed package, so a bare
   `import Search from '@arcgis/core/widgets/Search'` still resolves to the real
   `client\node_modules\@arcgis\core\widgets\Search.d.ts`, and VS reads it through the pnpm
   junction and throws `IDE1100 "Access to the path ... is denied"` on every SDK file the
   widget imports (Search Custom showed four: Color, FeatureLayer, reactiveUtils, Search). An
   ambient `declare module '@arcgis/core/*'` does not save you, for the same reason the
   jsx-runtime one does not: a resolvable real module beats an ambient declaration. The fix is
   to import the SDK through EB's `esri/*` alias instead (`esri/widgets/Search`,
   `esri/layers/FeatureLayer`, `esri/Color`, `esri/core/reactiveUtils`), which is the house
   convention already (the master shim declares `esri/*`, not `@arcgis/core/*`). `esri/*` has
   no real package behind it, so VS matches the ambient `esri/*` and never reads a node_modules
   file; EB's webpack aliases `esri/` to `@arcgis/core` at build, so the runtime is identical.
   Declare each SDK module the widget imports under `esri/...` in `src/editor-shims.d.ts`:
   classes as `export default class` so they work as both a value and a type
   (`useRef<Search>`), and namespaced helpers like `reactiveUtils` with their named exports so
   `import * as reactiveUtils` type-checks. Put `declare module '*.scss'` and `'*.css'` there
   too when the widget side-effect-imports a stylesheet (TS2882). Verified on Search Custom:
   `npx tsc -p .` reports 0 errors with TypeScript 5.6, and the program contains no
   `@arcgis/core` or `jimu-core` files. After changing the imports, confirm the EB build with
   `npm start` and exercise the widget once, because `npx tsc -p .` checks types, not webpack
   resolution.

   **Why the modes are exclusive.** `paths` makes TypeScript add the resolved files to the
   program even when an ambient `declare module` of the same name wins the binding. So a
   mode-A `paths` entry for `jimu-*` with a mode-B shim present pulls all of
   `client\jimu-core\lib` into the widget's program and reports Esri's source (TS2709 on
   `@esri/*` imports, `global.__esri` has no member, TS2430 interface conflicts) alongside
   `props`/`setState` "does not exist on type <Widget>" because `@types\react` came back
   empty. That combination is what produced an 87,712-line Error List export on
   report-a-concern-submit in September 2026. If you see jimu-core files in the File column
   of a widget's errors, the tsconfig still has `paths`.

   **Folder-level catch-all.** `client\your-extensions\widgets\tsconfig.json` (same compiler
   options as mode B, `include` `_vs/**/*.d.ts` and `*/src/**/*`, `exclude` `**/node_modules`,
   `**/tests/**`, `**/*.test.*`, and every widget that has its own tsconfig) catches widgets
   that have no tsconfig yet, so they do not fall through to Esri's `client\tsconfig.json`.
   Add each widget to its `exclude` list when you give it its own tsconfig.

   **Reading the Error List.** Open one widget folder at a time (`File > Open > Folder` on
   `client\your-extensions\widgets\<widget>`), never `client` or the EB root. Set the scope
   dropdown to **Open Documents** and leave it; sort by the File column before believing a
   count. Errors whose File is under `client\jimu-core`, `client\dist\widgets`, or
   `client\node_modules` are Esri's and not actionable; they appear whenever a file under
   `client` is open in a tab (F12 into a jimu symbol does this), because VS walks up and
   adopts `client\tsconfig.json`. VS caches all of it in the widget's `.vs` folder: close VS,
   delete `<widget>\.vs`, reopen. Under mode B, F12 on `PureComponent` or `AllWidgetProps`
   must land in `exb-editor-shims.d.ts`; if it lands in jimu-core or node_modules, the
   widget tsconfig is not the one in effect. The only permanent fix for IDE1100 itself is
   reinstalling the EB client with `node-linker=hoisted` in `client\.npmrc`, which is a
   bigger change and not required for any widget to build.

   Two mode B leftovers seen on Property Report 1.2.4, both harmless to the webpack build
   and both worth fixing so the Error List reads zero. `AllWidgetSettingProps<IMConfig>`
   from `jimu-for-builder` reports TS2709 ("Cannot use namespace as a type") because the
   master shim declares that module shorthand and a shorthand module cannot be typed; do
   not touch the master shim, replace the import with a local structural type
   (`{ id: string; config: IMConfig; onSettingChange: (settings: any, ...rest: any[]) => void;
   useDataSources?: any; useMapWidgetIds?: any; intl?: any; theme?: any; portalUrl?: string;
   [key: string]: any }`). And `config.set(key, value)` with a `string` key reports TS2345
   against the shim's `keyof Config`; write `config.set(key as any, value)` at the two or
   three generic update helpers rather than widening the shim. Separately, when files land in
   the widget folder while `npm start` is watching, webpack can compile between the arrival
   of `widget.tsx` and the new file it imports and report "Module not found" for a file that
   exists a second later, especially when the file is in a brand-new folder. Save the
   importing file once, or stop and restart `npm start`, before believing that error.
4. **Message actions** (`manifest.json` `messageActions`, `src/message-actions/*.ts`) let a
   Button or List widget drive yours without any public API: the action writes
   `appActions.widgetStatePropChange(widgetId, 'request', { ..., nonce })` and the widget reads
   `props.stateProps.request`. Include a `nonce` so the same request twice still fires.
5. **Draw widget interop.** Esri's Draw widget names its layer `jimu-draw-layer-<mapViewId>-*`;
   the GIS Division's Advanced Draw uses id `DrawGL`, keys graphics by `attributes.uniqueId`,
   only hit-tests its own layer (graphics anywhere else are unselectable), restores its drawings
   from localStorage on load, and listens for the window event `saveDrawingsToStorage` to
   re-read its layer and save. A widget that puts graphics on the map should: add them to the
   draw layer when it exists, watch `map.allLayers` for the layer appearing later and hand
   graphics over then, de-duplicate on `uniqueId` / `jimuDrawId` / geometry, and dispatch
   `saveDrawingsToStorage` after adding. Never modify Advanced Draw from another widget.
6. **`allLayers.on('change')` fires before the owning widget has finished setting a layer up.**
   Delay additions by a few hundred milliseconds (`setTimeout`, 400 ms worked).
8. **A button that does nothing, with no error: `import()` inside a widget.** Property Report
   lazy-loaded jsPDF and html2canvas with a dynamic `import()` so the initial bundle stayed
   small. webpack turns that into a separate chunk fetched at click time, and on several
   deployments (an exported app, a path prefix or proxy, a CSP) the chunk could not be
   loaded. The `await` sat before the "Generating PDF" overlay and outside every try/catch,
   so the promise rejected unhandled: the button took focus and nothing else happened, on
   every site, in every configuration. Two rules from it. Import widget dependencies
   statically; they ship in the widget bundle like everything else, and a static import that
   fails breaks the build visibly instead of production silently. And show the busy state
   first, then do the work inside the try, so a failure always produces a message. Fixed in
   Property Report 1.2.3.

7. **Config flags that turn a feature off must remove it everywhere**: the service stops
   reading and writing, the UI hides the controls, menus drop the item, help drops the line.
   Compute the booleans once at the top of `widget.tsx` and pass them down; components never
   read config themselves.

9. **Which Maps SDK component packages a widget may import.** Read
   `client\webpack\webpack.common.js` before importing anything from `@arcgis/*-components`.
   EB 1.21 externalizes `@arcgis/map-components`, `@arcgis/charts-components`,
   `@arcgis/coding-components`, `@arcgis/portal-components` and Calcite (import them as
   `arcgis-map-components`, `arcgis-charts-components`, `calcite-components` and so on; the
   widget then shares EB's copy). It does **not** externalize `@arcgis/common-components`, so
   `import '@arcgis/common-components/components/arcgis-slider'` would bundle a private copy
   of that library into the widget. Basemap Gallery Custom wanted `arcgis-slider` for its
   compare feature and used `CalciteSlider` from `calcite-components` instead, with
   `<arcgis-swipe>` from `arcgis-map-components` for the on-map divider. Maps SDK 5.x also has
   no `esri/widgets/*` classes; the component (`document.createElement('arcgis-swipe')`,
   `el.view = view`, `view.ui.add(el, 'manual')`) is the only path. Wait for
   `customElements.whenDefined('arcgis-swipe')` before creating it, and set `startLayers`
   (5.x) with a fallback to `leadingLayers` (4.x).

10. **A component added through `view.ui` blocks pan and zoom.** `view.ui` gives every hosted
    component `pointer-events: auto`, and a full-view component such as `arcgis-swipe` then
    swallows every pointer event. Set `pointer-events: none` inline on the host (inline beats
    the `.esri-ui .esri-component` rule) and add a small stylesheet to the component's shadow
    root (`adoptedStyleSheets`, `<style>` fallback) that keeps only the interactive parts
    (`.esri-swipe__divider`, `.esri-swipe__handle`) at `pointer-events: auto`. Apply it before
    and after `view.ui.add` and again on the component's `arcgisReady` event, because the
    shadow root may not exist until first render. Basemap Gallery Custom 1.21.2 has the helper
    (`letMapEventsThroughSwipe`).

11. **Swipe only clips layers that belong to the map.** To compare two basemaps, load the
    second one as its own `Basemap`, move its `baseLayers` and `referenceLayers` into
    `map.layers` at index 0 (below operational layers), and hand those layers to the divider.
    Never reassign `map.basemap` for the comparison; the saved web map must not change, and the
    live-sync watcher on `map.basemap` would fire. Remove and `destroy()` the layers on close,
    swap, view change, unmount, load failure after `addMany`, and when a config change drops the
    compared basemap. Guard a slow load with a request counter so a load that finishes after a
    later choice is discarded.

---

## 13. Storage patterns (from Droplets, reuse when a widget saves user data)

- **IndexedDB** for per-browser state (database name is a storage key: never rename it once
  users have data). Wrap in a small `Store` module with `put / get / list / remove / usage /
  getSetting / setSetting`.
- **Portal items** for state that should follow the user and be shareable: item type
  `Application`, typeKeywords `<widget>-item`, `<widget>-id-<id>`, `<widget>-exp-<key>`, data
  = the serialized record, thumbnail = preview image, in a named folder under My Content.
  Sharing uses the item's own `/share` and `/unshare`; sharing with specific people uses a
  widget-owned private group per record (`community/createGroup`, `addUsers`, `removeUsers`).
  Cache item data in IndexedDB keyed by item `modified`.
- **File System Access API** for a folder mirror (Chrome and Edge), with a manual
  download/upload fallback for Firefox and Safari.
- A **Repository** module is the only thing the widget talks to. It merges stores
  (last write wins by `updatedAt`), owns the "which stores are on" flags
  (`setFolderEnabled`, `setPortalConfig`, `setPrimaryStore`), and returns a `WriteOutcome`
  with a user-facing `message`.
- Offer the builder a **primary store** choice when more than one exists (browser mirrored to
  portal, or portal only). In portal-only mode the browser holds caches only and a refused
  portal write fails with a message rather than silently landing in the browser.
- **Nothing leaves the City's network**: verify egress with the browser Network tab, filtered
  to the portal host, while exercising every feature. Document how in the README.

---

## 14. Testing harness (Jest, no ExB runtime needed)

Droplets ships `tests/` with 60+ Jest tests that run in plain Node. The setup, so the next
widget starts with it:

- `package.json` devDependencies: `jest`, `ts-jest`, `@types/jest`, `fake-indexeddb`.
- `jest.config.js`:
  ```js
  module.exports = {
    testEnvironment: 'node',
    transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', diagnostics: false }] },
    moduleNameMapper: {
      '^jimu-core$': '<rootDir>/tests/stubs/jimu-core.js',
      '^esri/(.*)$': '<rootDir>/tests/stubs/esri.js'
    },
    testMatch: ['<rootDir>/tests/**/*.test.ts']
  }
  ```
- Each test file starts with `/** @jest-environment node */` and `import 'fake-indexeddb/auto'`
  when it touches IndexedDB. Stub `globalThis.document = {}` for modules that sniff the browser.
- Mock modules that need a browser or a portal with `jest.mock('../src/runtime/services/PortalStore', () => ({ ... }))`.
  Mock esri modules that do not exist on disk with `{ virtual: true }`:
  `jest.mock('esri/Graphic', () => ({ __esModule: true, default: { fromJSON: (j) => j } }), { virtual: true })`.
- Test the pure parts: codec (serialize/deserialize/normalize), merge rules, repository
  behaviour with stores mocked, graphics de-duplication, utilities. UI is not unit tested.
- Keep fixtures in `tests/helpers.ts` (`makeDroplet`, `makeSettings`). Every fixture uses the
  same experience key so tests are short.
- Run with `npx jest` from the widget folder; type check with `npx tsc -p .` (the widget
  tsconfig has `noEmit`). Both must be clean before a release.

---

## 15. Documentation set per widget

Beyond the README (Section 2), Droplets carries a `docs/` folder that made handover painless.
Do the same for any widget others will maintain:

```
docs/
├── EXPORT_FORMAT.md        <- the on-disk JSON format, versioned
├── PORTING_<version>.md    <- what changed when moving EB versions
└── handover/
    ├── README.md           <- where to start, how to build, how to release
    ├── CODE_STRUCTURE.md   <- file-by-file map, config keys, "where is X" table
    ├── STORAGE.md          <- every store, scope, merge rules, durability table
    ├── MAINTENANCE.md      <- routine tasks: bump EB version, add a config key, add a help line
    └── TROUBLESHOOTING.md  <- symptom | cause | fix table
```

`CHANGELOG.md` at the widget root, newest first, one heading per version with Added / Changed /
Fixed. Every ZIP or release bumps `manifest.json` and `package.json` together.

---

## 16. Taking over a widget bought from someone else (checklist)

Done once for Droplets. In order:

1. **Full code audit first**, before touching anything: crash paths (unguarded
   `attributes.x`), stale API paths, dead code, hard-coded strings, anything that phones home.
   Write the findings down; they become the first CHANGELOG entry.
2. **Fix the audit findings and get Visual Studio clean** (Section 12, item 3) in the same
   release, so the baseline is trustworthy.
3. **Remove the previous developer's branding** (names, company, URLs in code, docs, manifest,
   translations) unless a license requires attribution. Check the LICENSE first. Keep storage
   keys (IndexedDB database names, item typeKeywords) even if they carry the old name, because
   renaming them orphans every user's data; note this in STORAGE.md.
4. **Replace LICENSE** with the City's terms (internal-use notice for internal widgets,
   Apache-2.0 for ones we publish).
5. **Ask for everything**: source, tests, handover docs, build notes. Whatever does not arrive,
   write yourself (tests: Section 14; docs: Section 15).
6. **Add the standard files** from Section 2 and the tsconfig/shims from Section 12.
7. **Add builder switches** for every optional feature so each app can be configured down to
   exactly what its users need (Section 12, item 7), and the help guide (Section 10).
8. Only then start on new features.

---

## 17. Reference: Droplets

**Droplets is the UI/UX reference for the whole family.** When a question comes up about how
something should look or behave, open the Droplets source and match it rather than inventing an
answer, and when this document disagrees with that source, the source wins and this document is
what needs fixing. The files worth reading first: `components/HelpPopup.tsx` (Section 10),
`theme.ts` (Section 11.2), `components/Navbar.tsx` (the header and the Help button),
`components/HomePage.tsx` (the first-run hint and the banner recipe).

- Internal widget (portal storage on `portal22-gis`), not published to GitHub or Esri
  Community. Source lives in `client\your-extensions\widgets\dropletWidget`.
- Versions 1.0.1 through 1.7.x, September 2026: audit and VS cleanup, portal storage with
  sharing to organization, groups and people, jimu-ui and Calcite rebuild, filters and
  selections and popup capture, message action, search/sort/tags, bulk actions, overwrite
  history, help guide, accessibility pass, builder-controlled storage types, portal-only mode,
  Draw widget hand-off. CHANGELOG.md in the widget has the detail.

### Property Report: two lines of code exist

- **Live line, 1.2.x**, in `client\your-extensions\widgets\property-report` and the GitHub repo
  via `publish.ps1`. 1.2.3 is the PDF hotfix (12.8); 1.2.4 adds the help guide (10.10) and the
  mode B tsconfig (12.3). Everything else in the widget is the original code.
- **Audited line, 1.3.0 to 1.6.2**, delivered as zips in September 2026 and not deployed.
  Security fixes (stored XSS in rich text placeholders, href scheme allow-list, CSV formula
  and SQL literal escaping), a results race, spatial unit errors in nearby search, the PDF
  bookmark and page-number bugs, a config version manager, find-in-report, saved reports,
  print and export features, and 29 extracted modules with a test suite. `CHANGELOG-1.6.0.md`
  and `AUDIT-FINDINGS.md` in those zips are the record. It also carries the PDF hotfix.
  Adopting it means replacing `src/` wholesale, adding `qrcode` and `dompurify` to
  `package.json` (then `pnpm install` in `client`), and re-testing every configured site,
  because the header and toolbar markup changed. Decide deliberately; do not merge the two
  lines by hand. 1.6.2 carries the same help guide and mode B files as 1.2.4, so whichever
  line is deployed, the Visual Studio setup and the Help button are identical.

### Widgets on the shared UI/UX pattern

| Widget | Help guide | Notes |
|---|---|---|
| Droplets | 1.7.x | The reference. Function components, `useIntl`, tabbed header. |
| Print Advanced | 1.5.0 | Class component parent, so help strings are passed to `HelpPopup` as props and the class renders the function component for the theme hook. Proves the pattern works from a class widget. |
| Property Report | 1.2.4 | Function component, `props.intl` for `t`. Sixteen feature flags (10.10). Help button at the right end of the search row; mode B tsconfig (12.3) with a widget-level `vendor-shims.d.ts` for recharts, TanStack, jsPDF, html2canvas and Calcite beside the untouched `_vs` master shim. |
| Basemap Gallery Custom | 1.21.x | Function component, `props.intl` for `t`. Classic-JSX mode B with a byte-locked copied editor master (the consistency suite hashes it), so widget-specific declarations go in `src/vendor-shims.d.ts`. Fourteen help flags including `compare` and `comparing`. Node test runner (`node --test tests/*.cjs`, `vm`-transpiled with the client's TypeScript, no Jest); the content test forbids em dashes and the words instance, session, persist, sync, toggle, modal in guide text. Compare feature (12.9 to 12.11), idea credited to Nicholas Cramer. Published to GitHub/Community at 1.21.3. |
| Enhanced Measurement | 1.2.1 | Class component. First widget on classic-JSX mode B (12.3): the copied pragma-less `HelpPopup.tsx`/`FirstRunHint.tsx` triggered the jsx-runtime access-denied error under `react-jsx`, fixed with `jsx: "react"` plus a global JSX namespace in the shim. Eight measurement tools; Help button in a right-aligned header row. Published to GitHub/Community with 1.2.1 (1.1.0 was the prior public release, so 1.2.1 also carries the 1.2.0 help guide). |

Keep this table current. It is the list the consistency suite should cover.