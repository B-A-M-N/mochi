---
name: internationalization
description: Internationalize software correctly — externalization, Unicode handling, pluralization, locale-aware formatting, RTL layouts, and locale data pitfalls. Use when adding i18n to an app, fixing locale bugs, or preparing a product for non-English markets.
---

# Internationalization Procedure

i18n is not string translation — it's making the app locale-agnostic so translation becomes data. Retrofit order matters.

## 1. Externalize strings (the mechanical core)
- All user-facing strings through a lookup (`t('checkout.submit')`) — keys structured by screen.feature, not by English word. Concatenated sentences are banned (word order differs per locale): full phrases as units, interpolations as slots.
- Strings live in resource files per locale; the source locale complete at all times (CI check: missing keys fail the build, not the translation vendor).
- Never externalize: log messages, error codes, DB enum values. Translate: UI, emails, notifications, validation messages, a11y labels (screen readers speak the locale!).

## 2. Unicode (the bug farm)
- NFC normalization on all input; compare case-insensitively with locale-aware collation (Turkish dotless i, German ß) — `.toLowerCase()` comparisons are locale bugs.
- Length limits: count GRAPHEMES not UTF-16 units (JS `Array.from`/`Intl.Segmenter`); a 280 "character" limit that counts emoji wrong is a public bug report.
- Names/addresses are not first+last name fields: single full-name field, no letter-case assumptions, no phone regex beyond +E.164 sanity.

## 3. Pluralization and gender (where naive i18n breaks)
- `Intl.PluralRules` categories (zero/one/two/few/many/other) — Polish/Arabic/Russian need 3-6 forms; a ternary `count === 1` is English-only by construction.
- ICU MessageFormat for anything with embedded plurals/gender/select: "You have {count, plural, one {# apple} other {# apples}}".

## 4. Locale-aware formatting (use the platform, not regexes)
- `Intl.NumberFormat` / `DateTimeFormat` / `ListFormat` / `RelativeTimeFormat` for ALL display: dates (is `03/04` March 4 or April 3? yes), currency position, digit grouping, calendar systems (Buddhist, Islamic).
- Store datetimes as UTC instants; convert at display. Store currency as minor units (cents) + ISO code; never floats.
- Timezones: display in the USER's zone with zone label for anything schedulable ("14:00 CET") — server-local display is a meeting-at-3am generator.

## 5. RTL and layout mirroring
- `dir="rtl"` on the document flips layout: logical CSS properties (`margin-inline-start`, not `margin-left`) make mirroring free; retrofit = every hardcoded direction bites.
- Test Hebrew/Arabic pages with real content: numbers stay LTR inside RTL text (bidi), icons with directional meaning flip, direction-neutral icons (settings) don't.

## 6. Pseudo-localization before vendor translation
- Machine-generate `[!!! Þseudo →ŁöçàŁížèd !!!]`-style expansions (+40% length) to find: truncated layouts, hardcoded strings, un-interpolated concatenations — BEFORE paying translators and before shipping to the locale that finds it in production.
- German is +35% length, CJK is -40%: design for both ends at review time.

## Pitfalls
- Locale stored per-component or per-request instead of one resolution chain (URL > user pref > Accept-Language > default): inconsistent-language pages are worse than English.
- Translating at the string level what is actually cultural (dates, addresses, legal text, humor): the vendor politely renders nonsense — flag these for human review.
- Sort ignoring locale: `Array.sort()` on names is a phone-book bug in Swedish (ö after z) and everywhere collation matters — `Intl.Collator` or DB collation columns.
