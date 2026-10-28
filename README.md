# Studyset Studio

A private, browser-only tool that turns question–answer CSV text into a native `.goodnotes` Study Set.

**[Open Studyset Studio](https://plub15.github.io/studyset-studio/)** · [Test and deployment runs](https://github.com/Plub15/studyset-studio/actions)

## Use it

1. Choose a UTF-8 `.csv` or `.txt` file, paste your text, or try the example.
2. Name your set. Preview each card; click or press Space/Enter to flip it. Use the arrows to move between cards.
3. Optionally turn on **Create both directions**. The reverse of each pair immediately follows the original.
4. Choose **Create study set**, then **Download study set**. On browsers that accept this file through Web Share, **Share file** also appears.
5. Find the file in your browser's Downloads. On iPhone/iPad, check **Files → Downloads** in iCloud Drive or On My iPhone/iPad. Use Share → Goodnotes, or choose **New → Import** inside Goodnotes.

The creation step prepares the file in a worker. Download and Share then run directly from your next click/tap, keeping the user activation required by native sharing. Download filenames preserve Unicode, replace whitespace with underscores, and remove filesystem-unsafe characters so names stay consistent across browsers. The title inside Goodnotes is unchanged. The site cannot confirm a browser download was saved or that Goodnotes completed an import; its status messages say this explicitly.

## Input format

There is **no header**. Every record becomes a card, including repeated records:

```csv
1,하나
하나,1
2,둘
둘,2
"Hello, friend",สวัสดี 👋
"He said ""hello""","An answer
with two lines"
```

UTF-8 with or without a BOM is supported, including Korean, Thai, emoji, and other Unicode. Blank lines are ignored. Surrounding field whitespace is trimmed; internal spaces and quoted line breaks are preserved. Browser textareas normalize CRLF/CR line endings to LF. The direct converter API preserves the original quoted line ending style.

Each record needs exactly two nonempty fields. Put fields containing commas, quotes, or line breaks in double quotes. Escape an embedded double quote with another double quote. Malformed input gets a line-specific error and disables creation. A `Q,A` row is an ordinary card, not a special header.

Compared with the original Python parser, this version accepts whitespace outside quoted fields and rejects bare quotation marks inside unquoted fields. The native archive writer remains based on the supplied sanitized template.

## Privacy and limits

There are no runtime packages, CDN assets, analytics, accounts, or content upload requests. Source text stays in memory and is not written to browser storage. Closing or refreshing the page discards it. Content is displayed with `textContent`, never parsed as HTML. A Content Security Policy blocks network connections from the application (`connect-src 'none'`). Hosting still serves the public site files and may keep ordinary access logs; those requests contain no card content. Choosing **Share file** explicitly hands the file to the operating system and your chosen app.

To bound memory on mobile devices, the UI supports **2 MiB of UTF-8 input**, **5,000 output cards** (2,500 input pairs with both directions), and **20,000 UTF-16 code units per side** (an emoji may use two). The same limits are shown in the UI. Split larger sets. Parsing and archive generation run in a dedicated worker; editing or canceling stops outdated work. If a worker fails, the input is retained and a retry is offered. A one-minute watchdog handles a stalled conversion.

## Native format and compatibility

`converter.js` writes a real ZIP with schema-24 protobuf event streams, checksums, nested UTF-8 byte lengths, BigInt-backed uint64 values, new document/card/event UUIDs, and ordered card ranks. It preserves the supplied template's create/update/deleted-blank-card history; the deleted card is not counted as an output card. ZIP entries are stored without compression for a small dependency-free runtime. The internal inspection API intentionally supports these generated stored ZIPs, not arbitrary Goodnotes documents.

This is an independent, unofficial template-based writer, not a Goodnotes SDK. The supplied four-card reference was reported by its owner to import successfully. Browser-generated archives have been structurally/content-tested, but **have not been imported into Goodnotes on physical Apple hardware**. The extended card-rank scheme is inferred; physical import/order validation of large sets remains necessary. WebKit device profiles are emulation, not real iPhone/iPad Safari or an OS share sheet.

The app works in current browsers on desktop, Android, iPhone, and iPad. Goodnotes Study Set import availability depends on Goodnotes itself; see its [official import guidance](https://support.goodnotes.com/hc/en-us/articles/7353717956367-Import-and-export-Study-Sets). No Goodnotes import on Android/Windows is claimed here.

## Local development

Requires Node.js 22 or later, pnpm 11.25.0, and Python 3 for independent archive inspection. There is no server component to deploy.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:4173/studyset-studio/`. Re-run `pnpm build` after changing source files; the local server serves the `dist` directory. Do not open `index.html` through `file://`: ES modules and workers need HTTP(S).

```sh
pnpm test                              # converter + file/filename/limit tests
pnpm exec playwright install chromium webkit
pnpm test:browser                      # build, then all browser profiles
pnpm test:all
```

On Linux, install browser OS dependencies with `pnpm exec playwright install --with-deps chromium webkit`. Python is called as `python` on Windows and `python3` elsewhere; override `PYTHON` if necessary. To store browser binaries in the ignored local folder on Windows:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.local\browsers"
pnpm exec playwright install chromium webkit
pnpm test:browser
```

The test config automatically uses `.local/browsers` if present. Use `BASE_URL` to test a deployed site (no local server is started):

```powershell
$env:BASE_URL = 'https://plub15.github.io/studyset-studio/'
pnpm exec playwright test --project=chromium-desktop --grep '@smoke'
```

## Verification

The browser suite covers Chromium desktop, Pixel 7, 320px width, and WebKit iPhone SE, iPhone 13, iPad Mini, and iPad Pro 11 in portrait and landscape. Each profile checks CSV input/upload/drop, quoted multiline Unicode, reverse ordering, preview, validation, real Blob downloads with Unicode filenames, 1,000-card export, privacy requests, accessibility with axe, touch targets, overflow, keyboard help, reduced motion, worker recovery/cancellation, size limits, and the sharing contract.

Actual downloaded archives are inspected by `tests/inspect_archive.py`, an independent Python standard-library ZIP/protobuf reader. It checks CRCs, framing, 64-bit replica values, IDs, counters, title, full card content/order, deletion history, and selected card. Share API tests use controlled mocks to check the exact `File`, click activation, cancellation, and unsupported-sharing fallback. These are not physical native-share tests. Screenshots and reports are generated in `test-results` and `playwright-report`.

See [verification notes](docs/verification.md) for the completed runs and remaining hardware checks.

## Publishing

The GitHub Actions workflow tests first, packages an explicit allowlist into `dist`, deploys to GitHub Pages only after the tests pass, then runs a download smoke test against the public site. Enable Pages with **Source: GitHub Actions**. Pushes to `main` deploy; pull requests only test.

All script, asset, and worker URLs are relative to the application, so repository subpaths work. `.gitignore` excludes `reference/`, original handoff notes, generated archives, credentials, local tools, and test artifacts. The website allowlist additionally excludes docs, tests, and repository configuration. Keep private examples inside `reference/`; do not add them to the allowlist.

## Project layout

- `index.html`, `styles.css`, `assets/`: responsive interface and local icon.
- `app.js`: input, preview, worker lifecycle, download, and share controls.
- `app-utils.js`: UTF-8 decoding, limits, example, and safe Unicode filenames.
- `conversion-worker.js`: parsing and native archive generation off the main thread.
- `converter.js`: CSV parser, sanitized template, protobuf/ZIP writer and inspector.
- `tests/`: unit tests, Playwright checks, and independent Python decoder.
- `scripts/`: allowlisted static build and local server.
- `.github/workflows/pages.yml`: tests, Pages deployment, and public smoke test.

Not affiliated with or endorsed by Goodnotes.
