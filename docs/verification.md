# Verification record

Checked on 29 October 2026 (Asia/Bangkok). Local host: Windows; Playwright 1.64.1, Chromium 156, WebKit 27.2. The screenshots use synthetic example content.

## Executed local checks

- 36 Node tests passed, covering CSV parsing, malformed input, native archive framing/content/order, Unicode byte lengths, uint64 precision, unique IDs, CRC corruption, decoding, filenames, and size limits.
- All 88 browser cases reported passing: eight checks on each of the 11 profiles below. The Windows sandbox prevented automatic local test-server cleanup after the cases finished; CI separately runs the complete suite and gates deployment on its exit status.
- Each profile downloaded both a Unicode 12-card reversed set and a 1,000-card set. Every downloaded file was independently checked using Python `zipfile`, CRC checks, and a separate protobuf decoder. The decoder verified exact title, count, content, order, IDs, counters, selection, deletion history, and the full 64-bit replica integer.
- Network observation allowed only public application resource GETs, without query strings or request bodies. No content transmission was observed. The application contains no upload/fetch/analytics code and uses a restrictive Content Security Policy.
- axe checks found no WCAG 2 A/AA or 2.1 AA violations in the populated page and open help dialog. Keyboard operation/focus, 44px controls, 16px input text, reduced motion, and horizontal overflow were also checked. Automated checks are not a complete manual screen-reader audit.
- Desktop, iPhone 13, and iPad Mini screenshots were visually inspected. All profile screenshots are included in CI test artifacts when the suite runs.
- Local reference comparison confirmed that the public sanitized template retains the original event-kind sequence and does not contain any of the original archive's UUIDs. Reference files are ignored and excluded from the static build.

| Browser / profile | CSS viewport | Result |
| --- | --- | --- |
| Chromium desktop | 1440 × 1080 | 8/8 passed |
| Chromium Pixel 7 | 412 × 839 | 8/8 passed |
| Chromium narrow | 320 × 740 | 8/8 passed |
| WebKit iPhone SE portrait | 320 × 568 | 8/8 passed |
| WebKit iPhone SE landscape | 568 × 320 | 8/8 passed |
| WebKit iPhone 13 portrait | 390 × 664 | 8/8 passed |
| WebKit iPhone 13 landscape | 750 × 342 | 8/8 passed |
| WebKit iPad Mini portrait | 768 × 1024 | 8/8 passed |
| WebKit iPad Mini landscape | 1024 × 768 | 8/8 passed |
| WebKit iPad Pro 11 portrait | 834 × 1194 | 8/8 passed |
| WebKit iPad Pro 11 landscape | 1194 × 834 | 8/8 passed |

## Screenshots

[Desktop](screenshots/desktop.png) · [iPhone 13](screenshots/iphone.png) · [iPad Mini](screenshots/ipad.png)

## Deployment checks

The [Test and publish workflow](https://github.com/Plub15/studyset-studio/actions) runs unit and full browser tests before deployment, then a real download smoke test against the public URL. Consult its completed run for deployment status; a successful build alone does not establish publication.

## Remaining physical checks

WebKit device profiles are browser emulation. No physical iPhone/iPad, real OS share-sheet destination, or Goodnotes application import was tested. The sharing tests replace `navigator.canShare` and `navigator.share` to verify that the actual nonempty `File` is checked, transient click activation is preserved, and cancellation/unsupported cases retain downloading. They do not prove OS acceptance of the `.goodnotes` extension.

The supplied four-card reference was reported by its owner to work in Goodnotes. Newly generated browser archives still need an actual Goodnotes import check, including large-set ordering. Their schema and extended rank interpretation are unofficial. No claim is made about Goodnotes Study Set import support on Android/Windows.
