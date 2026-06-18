# Project: محاسب تك (Muhaseb Tech) — Design Preferences

## Language & Locale
- **Trilingual: English (LTR, default), Arabic (RTL), German (LTR)** — runtime-switchable via the sidebar footer (button order: EN, AR, DE — same order as `LANGS` in `src/i18n/messages.ts`)
- Default on first launch: **English**. No browser detection — every fresh install starts in English; the user can switch from the sidebar. Choice persisted in `localStorage['muhaseb-tech:lang']`
- All UI strings live in the typed dictionary at `src/i18n/messages.ts`. Access them via `useT()` from `src/i18n/LangProvider.tsx` — never hard-code text in JSX. The Arabic dictionary defines the `MessageKey` master; German and English are typed as `Record<keyof typeof ar, string>` so missing keys break the build
- Seed data (default categories, sample transactions in `src/lib/reducer.ts`) intentionally stays Arabic; English/German users rename the defaults as needed
- Use Arabic terminology consistent with the Excel file (التبرعات، رسوم العضوية، الإيجار والمرافق، etc.)
- **Numbers in the English UI: en-US locale** (1,234.00)
- **Numbers in the Arabic UI: English numerals** (1,234.00) — never Arabic-Indic (١٬٢٣٤٫٠٠)
- **Numbers in the German UI: de-DE locale** (1.234,00)
- `src/lib/format.ts` exports `fmt`/`fmtA`/`fmtDate`/`fmtMonth` that all take a `Lang` parameter (default `'en'`). `useT()` exposes pre-bound variants (`fmtMoney`/`fmtMoneyAbs`/`fmtDate`/`fmtMonth`) that read the active language automatically
- English currency: `€` + narrow NBSP (U+202F) + number, e.g. `€ 1,234.00`
- Arabic currency: same as English — `€` + narrow NBSP + number
- German currency: number + narrow NBSP + `€`, e.g. `1.234,00 €`
- English dates: `April 1, 2026` (en-US, month-first); months: `April 2026`
- Arabic dates: `1 أبريل 2026`; German dates: `1. April 2026`

## Typography
- Latin (English, German): **IBM Plex Sans** (weights 400, 500, 600, 700) — the default
- Arabic: **IBM Plex Sans Arabic** (same weights) — applied via `html[data-lang='ar']` override
- Both fonts are loaded in `index.html`. CSS variable `--app-font` defaults to IBM Plex Sans and switches to IBM Plex Sans Arabic only when `html[data-lang='ar']` (set at document root by LangProvider and by the boot snippet in `src/main.tsx`)
- Body font uses `var(--app-font)`; a global `button, input, textarea, select { font-family: inherit }` rule cascades it into form elements. Do NOT set inline `fontFamily` in components
- Minimum font size: 14px for body, 13px for labels/captions

## Color Palette
- **Primary (Teal):** `oklch(42% 0.11 195)` — headers, sidebar, active states
- **Teal dark:** `oklch(32% 0.10 195)` — sidebar background
- **Teal light:** `oklch(93% 0.04 195)` — teal tints, hover backgrounds
- **Income (Green):** `oklch(52% 0.13 155)` / light: `oklch(96% 0.04 155)`
- **Expense (Red):** `oklch(55% 0.14 25)` / light: `oklch(96% 0.04 25)`
- **Background:** `oklch(97% 0.006 200)`
- **Surface:** `#ffffff`
- **Border:** `oklch(90% 0.01 195)`
- **Text:** `oklch(18% 0.01 195)`
- **Text muted:** `oklch(52% 0.02 195)`

## Target Users
- Elderly people and users with low technical knowledge
- Prioritize **large text, large touch targets (min 44px)**, clear labels
- Avoid jargon — use simple, familiar Arabic words
- Always confirm destructive actions (e.g. delete) with `window.confirm()`

## Responsive Breakpoints
| Breakpoint | Layout |
|---|---|
| Mobile `< 640px` | Bottom nav, stacked cards, FAB button, bottom-sheet modals |
| Tablet `640–1100px` | Icon-only sidebar, 2-col cards, centered modals, card list |
| Desktop `> 1100px` | Full labeled sidebar (240px), 4-col stats, data tables, centered modals |

## App Structure (4 screens)
1. **لوحة التحكم** / **Übersicht** (Dashboard) — balance hero, monthly/yearly stats, recent transactions, category bar chart (desktop)
2. **المعاملات** / **Buchungen** (Transactions) — filter tabs, search, table (desktop) or cards (mobile/tablet), add transaction modal. A summary bar above the list shows total income / total expense / net for the **currently filtered** set (reuses `sumByType`; transfers excluded, matching the Dashboard).
3. **المتكررة** / **Wiederkehrend** (Recurring) — manage monthly recurring rules (view / add / edit / stop). Available on all platforms (desktop + mobile). See § Recurring transactions below.
4. **الفئات** / **Kategorien** (Categories) — manage income & expense categories, side-by-side on tablet/desktop

## App Structure (desktop addition)
5. **السجل** / **Verlauf** (History) — desktop-only screen showing the undo-tree as a flat-with-branches list; lets the user restore any past version.
6. **استيراد/تصدير** / **Import/Export** — Tauri-only screen for exporting the current state to an `.xlsx` file and importing one back. Import shows a preview with skipped-row diagnostics, then offers append vs replace; replace gates on `window.confirm()`. The import is a single undo-tree snapshot.

## Recurring transactions
- A **`RecurringRule`** (see `src/types.ts`) is a monthly template: `{ type, category, description, amount, bucket, toBucket?, dayOfMonth, startDate, lastMaterialized }`. Rules live in `AppData.recurring[]`, separate from the transactions they generate. Open-ended — a rule recurs until the user deletes it (no end date / count).
- Generated transactions carry `recurringId` (drives the 🔁 badge in `TxRow`); they are otherwise ordinary transactions. Editing or deleting a generated transaction does **not** touch the rule, and editing/deleting a rule does **not** rewrite already-generated transactions (they are real money events).
- **Watermark model:** `lastMaterialized` is an exclusive lower bound — occurrences in `(lastMaterialized, today]` are pending. This is why a manually-deleted occurrence never resurrects on the next load. All occurrence math is pure and lives in `src/lib/recurrence.ts` (`monthlyOccurrences` clamps day 31 → Feb 28/29; `pendingOccurrences`, `nextOccurrence`, `prevDayIso`, `occurrenceToTx`).
- **Creation paths:** the Transactions add-modal has a "Repeat every month" toggle (add mode only — `onAddRecurring`), and the Recurring screen has its own add/edit modal (`RecurringRuleModal`, day-of-month picker, no attachments). The **store** (`useStore.addRecurring`) decides which occurrences are actually due (`<= today`) and passes the built transactions into the reducer, so a future `startDate` never creates a balance-skewing transaction before its time.
- **Backfill:** `useStore` runs one catch-up materialization on load (`materializeRecurring`, a single undo-tree snapshot; no-op when nothing is due), so reopening the app after a gap generates every missed month.
- Reducer actions: `addRecurring` / `updateRecurring` / `deleteRecurring` / `materializeRecurring`, each with its own undo descriptor. The Recurring screen is **not** mobile-hidden (unlike History / Import-Export).

## Tech Stack (desktop app)
- **Tauri 2** wrapper, **React 18 + TypeScript + Vite** UI
- No external component libraries; inline styles match the design prototype
- Persistence: JSON file in OS app-data dir via `@tauri-apps/plugin-fs` (atomic write, key: `data.json`)
- Versioning: undo-tree (`src/lib/history.ts`) stored alongside the data
- Use `oklch()` for all new colors to stay harmonious with the palette

## Workflow
- Run dev (Tauri window): `pnpm tauri dev`
- Run dev (browser only): `pnpm dev`
- Verify after each step: `pnpm verify` = ESLint + tsc + Vitest
- E2E: `pnpm e2e` (Playwright against the web build)
- Build native installers: `pnpm tauri build`
- Always commit per implementation step, with a clear message tied to that step
- **After a successful `git push` to `main`, ask the user whether to also cut a release.** If yes, hand off to the `publish-release` skill (`.claude/skills/publish-release/SKILL.md`). Skip the prompt for non-feature pushes (docs-only, internal tooling, work-in-progress branches).

## Persistence layer
- Detected at runtime via `isTauri()`:
  - In Tauri window → `@tauri-apps/plugin-fs` writes atomically to `$AppConfig/muhaseb-tech/data.json`. `$AppConfig` is Tauri's `BaseDirectory.AppConfig`, which **already includes the bundle identifier** as a path segment — so the full on-disk path is e.g. `%APPDATA%\com.codetiquette.muhasebtech\muhaseb-tech\data.json` on Windows, `~/Library/Application Support/com.codetiquette.muhasebtech/muhaseb-tech/data.json` on macOS, `~/.config/com.codetiquette.muhasebtech/muhaseb-tech/data.json` on Linux.
  - In browser → `localStorage` key `muhaseb-tech:data`
- Disk format (v7): `{ schemaVersion: 7, history, deviceId, currency, serverState? }`. (v6 added `AppData.recurring[]` inside every snapshot — see § Recurring transactions; v7 added `AppData.opening` — see § Opening balances.)
  - `deviceId` is a per-install UUID generated on first load (or during v3 → v4 migration). It also stamps every new `Snapshot.deviceId` so the sync layer can attribute authorship.
  - `currency` is a top-level `CurrencyCode` (one of EUR/USD/GBP/SYP/SAR/AED/TRY — registry at `src/lib/currency.ts`). Stored as a sibling of `history` rather than inside snapshots, so changing the currency from Settings does **not** create an undo-tree entry. Add new codes to `src/lib/currency.ts` and they automatically surface in both the first-run modal and Settings. Symbol position is per-currency (EUR/USD/GBP/TRY prefix; SYP/SAR/AED suffix) and language-independent — number separators still come from the active `Lang`.
  - `serverState` (optional) holds sync bookkeeping when the user enables sync from Settings. Absent on disk = local-only mode. See `docs/sync-architecture.md` for the full sync design.
- Bump `SCHEMA_VERSION` and extend `parseAndMigrate` in `src/lib/persist.ts` for new migrations. Current migrators: v3 → v7, v4 → v7, v5 → v7, v6 → v7. The v3/v4 steps generate/preserve a `deviceId` and default `currency` to EUR. Every branch runs `migrateHistory`, which composes two idempotent backfills: `backfillRecurring` (v5 → v6: adds `recurring: []`) and `backfillOpening` (v6 → v7: adds `opening: { bank: 0, cash: 0 }`). Both repair malformed/already-current files on load too. v1 and v2 have no migrator; old data is discarded silently. The v3 → v4 step leaves pre-v4 snapshots' `deviceId` absent on purpose — the sync layer treats absent `deviceId` as "this device" when reconciling. Unknown `currency` values are silently backfilled to EUR rather than rejected. The v6 → v7 step does **not** convert pre-existing "Opening balance" transactions (seeded by the old first-run flow) into the new field — they remain ordinary transactions.

## First-run
- True cold start = `load()` returns `null`. `useStore` flips `isFirstRun` to `true` and leaves `currency` as `null` until the modal completes; the auto-save effect is gated on `currency !== null` so we never persist a half-configured file.
- `App.tsx` renders `<FirstRunModal />` over the main shell whenever `isFirstRun` is true. The modal is **mandatory** — no close button, no Esc dismiss. It contains a compact language switcher (the sidebar's language footer is covered by the scrim), a currency picker, and two opening-balance inputs (bank + cash, both defaulting to 0).
- On submit the modal calls `useStore().completeFirstRun({ currency, bankOpening, cashOpening })`, which sets the currency and — if at least one balance is non-zero — dispatches the `setOpeningBalances` reducer action (see § Opening balances). This is the same action the Settings screen uses, so first-run no longer creates any seed transaction or category.
- Existing users (post-v4 → v5 migration) silently get `currency: 'EUR'` and never see the modal.

## Opening balances
- `AppData.opening` (`OpeningBalances = { bank, cash }`, in `src/types.ts`) holds the starting balance per bucket. It is a **first-class field, not a transaction** — it never appears in the transactions list, the recent-transactions feed, or the income/expense totals (`sumByType`). It may be negative (e.g. an overdrawn account).
- Folded into displayed balances by `bucketBalance(tx, bucket, opening?)` / `totalBalance(tx, opening?)` in `src/lib/balance.ts` — the `opening` arg is optional (omitted ⇒ 0) so callers that only want the transaction-derived balance can skip it. The Dashboard hero passes `store.data.opening`; nothing else needs to.
- Set from **two places**, both via the `setOpeningBalances` reducer action (`{ bank, cash }`, one undo-tree snapshot, `setOpening` descriptor / `undo.setOpening`): the first-run modal (`completeFirstRun`) and the **Settings** screen's "Opening balance" card. The reducer replaces (does not accumulate) the stored pair, coerces non-finite inputs to 0, and is a no-op when the values are unchanged.
- The Settings card prefills its inputs from the stored `opening`, re-syncs on change (incl. undo/redo), disables Save until dirty, and shows a transient "Saved" confirmation. The legacy `seedOpeningBalances` action and the `category.openingBalance` / `tx.openingBalance.*` strings are **gone**; old data keeps any transactions they already produced (see the v6 → v7 migration note under § Persistence layer).

## Undo-tree
- `src/lib/history.ts` — every mutation creates a snapshot; non-leaf edits create branches
- `restore(id)` is a forward commit (older snapshots are immutable)
- Cap: 200 snapshots; oldest non-root, non-current nodes are dropped first with their
  children re-parented up so the chain stays connected

## Attachments
- **Tauri desktop only.** Disabled on mobile and in the browser; both render a disabled hint. Mobile is blocked by `@tauri-apps/plugin-dialog` returning content URIs instead of filesystem paths (so the Rust `std::fs::copy` in `copy_attachment` can't consume them) plus `@tauri-apps/plugin-opener` only supporting URLs on mobile. Path A (custom JNI bridge to `ContentResolver` + a FileProvider declaration in `AndroidManifest.xml`) is the v2 unblocker.
- On desktop: files are picked via `@tauri-apps/plugin-dialog`, copied by the Rust `copy_attachment` command into `$AppConfig/muhaseb-tech/attachments/<attachmentId>.<ext>`, and opened with the system default app via `@tauri-apps/plugin-opener`.
- We never read attachment bytes into JS — no MIME detection, no size cap, no content inspection. The `Attachment` metadata in `data.json` only stores `{ id, filename, ext }`.
- The gate lives in `src/components/AttachmentsList.tsx` (`supported = attachmentsSupported() && bp !== 'mobile'`). Picker UI handles the falsy branch with a disabled hint.
- **No GC.** Files on disk are never deleted: removing an attachment from a transaction (or deleting the transaction) leaves the file in place because past undo-tree snapshots may still reference it. A future GC pass tied to snapshot eviction is out of scope.

## Import/Export
- Tauri-only feature (browser shows a disabled hint). Lives in `src/screens/ImportExport.tsx`; serialization in `src/lib/excel.ts` (uses the `xlsx` SheetJS library).
- Format: `.xlsx` workbook with two sheets — `Transactions` (columns: `date`, `type`, `bucket`, `toBucket`, `category`, `description`, `amount`) and `Categories` (columns: `type`, `name`). Headers are stable English identifiers — do not localize them.
- `id` and `attachments` are intentionally **not** round-tripped. Imported transactions get a fresh `crypto.randomUUID()` and `attachments: []`. Attachment binaries are not bundled into the Excel.
- Import validation rejects bad rows (invalid date/type/bucket, non-positive amount, transfer with same bucket on both sides) and surfaces them as a skipped-rows panel — valid rows still go through.
- Importer auto-backfills `cats` from any transaction category that wasn't listed in the Categories sheet, so a transactions-only Excel still produces a consistent view.
- The whole import is a **single undo-tree snapshot** via the `importData` reducer action, so the user can undo it as one step regardless of how many rows were imported.
- File picking uses `@tauri-apps/plugin-dialog` (`save` / `open`); reading + writing the bytes uses `@tauri-apps/plugin-fs` (`readFile` / `writeFile`). Capabilities: `fs:read-files` + `fs:write-files` are granted; the dialog plugin auto-registers the picked path in the runtime fs scope.

## Auto-update (OTA)
- **macOS + Windows only.** Linux targets (`.deb`/`.rpm`) aren't supported by Tauri's updater; a Linux path would require switching to AppImage and is not yet wired.
- Built on `tauri-plugin-updater` + `tauri-plugin-process`. `src/lib/updater.ts` wraps the JS plugin; `src/components/UpdateModal.tsx` is the install UX; `src/App.tsx` fires a one-shot `check()` on mount.
- The plugin reads a signed manifest at `https://github.com/moazbaghdadi/muhaseb-tech/releases/latest/download/latest.json`. GitHub's `/releases/latest/...` redirector ignores drafts, so OTA only fires once a release is **promoted from draft to published** — the existing publish-release flow already gates this.
- The manifest is built by the `manifest` job in `.github/workflows/release.yml` (runs after the matrix `build`). It downloads `.sig` files from the just-published draft, assembles `latest.json` (only mac aarch64/x86_64 and Windows NSIS), and uploads it to the same release.
- Signing keypair: private key + password live as GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Public key is embedded in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. The local copy is at `~/.tauri/budget-tracker.key{,.pub,.password}` — never commit any of these.
- **Losing the signing private key bricks all future auto-updates** (every installed client validates against the embedded public key, so rotating the key would orphan existing installs). Treat it like a code-signing cert.
- `bundle.createUpdaterArtifacts: true` in `tauri.conf.json` is what causes `tauri-action` to produce `.sig` files alongside each installer.

## Mobile targets

Mobile port plan lives at `~/.claude/plans/mobile-port.md`. Phase-0 decisions recorded below; later phases implement them.

### Target platforms
- **Android first.** Buildable from Linux on `ubuntu-latest` CI; $25 one-time Play Console fee.
- **iOS deferred.** Gated on Mac access (physical or `macos-latest` GitHub runner) and Apple Developer enrollment ($99/yr). Treat as a separate optional milestone.

### Minimum OS versions
- **Android: API 26** (Android 8.0, 2017). Tauri's default minimum is API 24 (7.0); API 26 buys an updatable WebView via Play Store with negligible user-base loss.
- **iOS (when iOS lands): 15.4** — required for `oklch()` colors in WKWebView. (Earlier versions would force a palette rewrite.)

### Bundle identifier
- Unified identifier across desktop and Android: **`com.codetiquette.muhasebtech`** — single CodeTiquette developer account on both Play Store and (eventually) Apple. The desktop `identifier` in `tauri.conf.json` and the Android `applicationId` / `namespace` (Gradle + `tauri.android.conf.json`) all carry the same value.
- The identifier collapses `muhaseb-tech` to `muhasebtech` (no hyphen) because Java package syntax — enforced by Play Console — does not permit hyphens. Desktop tolerates hyphens, but matching the Android-legal form keeps the two platforms in sync.
- The per-platform override mechanism via `tauri.android.conf.json` is kept in place even though the values currently match; it leaves room to diverge again later without restructuring the config.

### Plugin support matrix (verified May 2026 against v2.tauri.app)
| Plugin | Desktop | Android | iOS | Notes for our usage |
|---|---|---|---|---|
| `plugin-fs` | ✅ | ✅ (sandboxed to app dir) | ✅ (sandboxed; needs `PrivacyInfo.xcprivacy` for `NSPrivacyAccessedAPICategoryFileTimestamp`) | `persist-tauri.ts` only touches `BaseDirectory.AppConfig`, fully supported |
| `plugin-dialog` | ✅ | ⚠️ open() returns **content URIs**, no folder picker | ⚠️ open() returns `file://` URIs, no folder picker | Breaks `attachments.ts` and `excel.ts` (both assume plain paths) |
| `plugin-opener` | ✅ | ⚠️ **URLs only** — no local file open | ⚠️ URLs only | Breaks `openAttachment` on mobile |
| `plugin-process` | ✅ | ❌ | ❌ | `relaunch()` / `exit()` unavailable on mobile |
| `plugin-updater` | ✅ | ❌ | ❌ | Mobile uses store updates |

### v1 feature scope on mobile
| Feature | Desktop | Mobile (v1) | Rationale |
|---|---|---|---|
| Dashboard | ✅ | ✅ | Core feature |
| Transactions | ✅ | ✅ | Core feature |
| Recurring | ✅ | ✅ | Core feature; no native APIs involved, so it ships on mobile too |
| Categories | ✅ | ✅ | Core feature |
| Settings (language) | ✅ | ✅ | Verify Arabic RTL on the AVD during Phase 3 |
| History (undo-tree browser) | ✅ | ❌ hide | Already desktop-only by design; small-screen UX cost not worth a v1 port |
| Import/Export `.xlsx` | ✅ | ❌ hide | `dialog.open` returns content URIs that `plugin-fs.readFile` can't consume; xlsx bundle is heavy on mobile cold start |
| Attachments | ✅ | ❌ hide | `dialog.open` → URI mismatch with the Rust `std::fs::copy` command, plus `opener` can't open local files on mobile. Full support would need custom JNI + FileProvider |
| OTA auto-updater | ✅ | ❌ disable | `plugin-updater` is desktop-only; Play Store handles updates |

All mobile-hidden features stay fully functional on desktop. The gating lives in `src/components/nav-items.ts` (`MOBILE_HIDDEN_SCREENS`) and `src/App.tsx` (route guard + `checkForUpdate` skip on mobile). `tauri-plugin-updater` is also Cargo-target-gated to desktop only and its plugin init in `src-tauri/src/lib.rs` is `#[cfg(desktop)]`-wrapped.

### Known mobile-specific risks (carried into later phases)
- `isTauri()` (currently `'__TAURI_INTERNALS__' in window`) is `true` on mobile too, so the Tauri persistence path runs. Good — but anywhere that conflates "Tauri" with "desktop" needs auditing in Phase 5.
- Fonts (IBM Plex Sans + Plex Sans Arabic) load from Google Fonts via `index.html`. The CSP already allows `fonts.googleapis.com` / `fonts.gstatic.com`. On mobile cold-start with no network, fonts fall back to system; acceptable.
- `oklch()` colors require Chrome WebView ≥ 111 (Android) and WKWebView ≥ 15.4 (iOS). Both are above the floors picked above.

## Mobile development (Android)

Scaffolded by `pnpm tauri android init` (Mobile Phase 1). The generated Gradle project lives in `src-tauri/gen/android/`.

### One-time machine setup
- Android SDK at `$ANDROID_HOME` (default `~/Android/Sdk`); `cmdline-tools` installed at `$ANDROID_HOME/cmdline-tools/latest/`.
- NDK r29 (or later) under `$ANDROID_HOME/ndk/`; set `NDK_HOME` to the chosen version dir.
- Rust mobile targets: `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`.
- An Android Virtual Device. Existing AVD: `Pixel_7`. Boot from CLI: `$ANDROID_HOME/emulator/emulator -avd Pixel_7`.
- JDK 21 works with Tauri 2.10+; older docs said JDK 17 — disregard.

Persistent shell config (`~/.zshrc`):
```sh
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/29.0.14206865"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator"
```

### Workflow
- `pnpm android:dev` — launches the app in a running AVD (boot the emulator first; `adb devices` should list it).
- `pnpm android:build` — produces signed AAB + APK release artifacts under `src-tauri/gen/android/app/build/outputs/`.

### Android specifics
- `applicationId` is `com.codetiquette.muhasebtech` (unified with the desktop identifier; CodeTiquette developer account on Play Store).
- `minSdk = 26` (Android 8.0); see § Mobile targets above for the rationale.
- `tauri-plugin-updater` is desktop-only: the Cargo dep is target-gated (`cfg(not(android|ios))`) and the init call in `src-tauri/src/lib.rs` is `#[cfg(desktop)]`-gated. Mobile updates flow through Play Store.
- On-device data path: `/data/user/0/com.codetiquette.muhasebtech/muhaseb-tech/data.json` — under the app's data root, **not** under `files/` (verified on Android via Tauri's `BaseDirectory.AppConfig`). Inspect via `adb shell run-as com.codetiquette.muhasebtech ls muhaseb-tech/`.
- Generated Gradle/Android files in `src-tauri/gen/android/` are committed; the inner `.gitignore` keeps build outputs out.

### Mobile release pipeline

Signed AAB + universal APK are produced on every `v*` tag push by the `android` job in `.github/workflows/release.yml` (sibling of the desktop matrix). Locally reproducible via `pnpm tauri android build`. First proven end-to-end on v0.7.2 (2026-05-22).

**Upload keystore** (the Play Store signing identity for `com.codetiquette.muhasebtech`):
- File: `~/keystores/muhaseb-tech-release.keystore` (PKCS12, RSA-2048, 25-year validity, never in repo).
- Alias: `muhaseb-tech-upload`.
- Fingerprints + DN recorded in Claude project memory (`project_mobile_keystore.md`). The same Austrian-company Play Console org account that ships TicketShop will publish this app — see `reference_play_console_shared_account.md` for the Phase 7 implications (no $25 fee, no identity verification, no banking re-setup).
- **Losing this keystore *before* Play App Signing enrolment bricks all future updates for `com.codetiquette.muhasebtech`** — same risk class as the OTA signing key. After first AAB upload, Google's Play App Signing holds the canonical app-signing cert and the upload-key fingerprint diverges; record Google's cert separately at that point.

**Local signing config:** `src-tauri/gen/android/key.properties` (gitignored at `src-tauri/gen/android/.gitignore:16`) supplies `storeFile` / `storePassword` / `keyAlias` / `keyPassword` to the gradle `signingConfigs.release` block in `src-tauri/gen/android/app/build.gradle.kts`. A template `key.properties.example` is checked in for first-time setup — copy it, fill in real passwords from your password manager, never commit the real file. The gradle wiring is conditional (`if (keystoreProperties["storeFile"] != null)`) so `pnpm android:dev` keeps working without `key.properties` (debug builds use the Android debug keystore as usual).

**CI signing config:** four GitHub repository secrets are baked into the same `key.properties` shape at workflow run time:
- `ANDROID_KEYSTORE_BASE64` — `base64 -w0 ~/keystores/muhaseb-tech-release.keystore`.
- `ANDROID_KEYSTORE_PASSWORD` — store password.
- `ANDROID_KEY_ALIAS` — `muhaseb-tech-upload`.
- `ANDROID_KEY_PASSWORD` — key password (same value as store password is fine; that's the keytool default).

**Build outputs:**
- AAB (Play upload): `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab` (~45 MB; Play splits per-ABI on delivery so device-side download is ~30–40 MB).
- Universal APK (sideload): `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk` (~142 MB; contains all 4 ABIs).

**Pipeline ordering:** the `android` job has `needs: build` so it runs after the desktop matrix completes. This avoids a race where both `tauri-action` (desktop) and `softprops/action-gh-release` (android) try to create the same draft release simultaneously. Total wall-clock with android is ~15 min (vs ~12 min desktop-only).

**Verifying a signed artifact:** `apksigner verify --print-certs <apk>` (in `$ANDROID_HOME/build-tools/<version>/`) prints the embedded cert's DN + SHA-256. The SHA-256 must match the keystore fingerprint recorded in memory; mismatch means the wrong key got picked up.
