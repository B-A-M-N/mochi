---
name: seo-technical
description: Technical SEO and web performance — crawlability, structured data, Core Web Vitals, and ranking-factor hygiene for web apps. Use when building or fixing a site that needs to rank, diagnosing traffic drops, or auditing a site's search health.
---

# Technical SEO Procedure

Ranking is downstream of crawlability, renderability, and performance. Fix the machine layer before touching content.

## 1. Crawlability audit
- robots.txt correct (no accidental `Disallow: /`), sitemap.xml accurate (only 200-status, canonical URLs, <50k entries/sitemap), submitted in Search Console.
- Status hygiene: no soft-404s (200 pages that render "not found"), redirects 301 not 302 for permanent moves, no redirect CHAINS (point directly at the final URL).
- Canonical tags self-referencing by default; parameterized/filtered URLs canonicalized to the clean URL.

## 2. Renderability
- Critical content server-rendered or prerendered — if the content requires JS + an API call, Google sees it late and users see it never on slow phones. SSR/SSG/ISR for indexable pages; CSR behind auth only.
- Check what the crawler sees: `curl` the URL as Googlebot, or view-source test — the H1 and main content should be IN the HTML.

## 3. Core Web Vitals (the ranking tiebreaker)
- LCP <2.5s: hero image preloaded (`fetchpriority=high`), server render, CDN-cached. CLS <0.1: explicit width/height on ALL media, no late-loading banners above content. INP <200ms: break long tasks, defer non-critical JS.
- Measure from REAL users (CrUX/field data), not just lab Lighthouse — the field data is what ranks.

## 4. Structured data (rich results)
- JSON-LD for the entity types you qualify for: Organization, Article/Product/FAQ/HowTo/BreadcrumbList. Validate with the Rich Results Test — errors suppress the rich result entirely.
- Structured data must match visible content (mismatch = manual action risk).

## 5. Content-technical alignment
- One page = one intent; duplicate-intent pages consolidated (301 + canonical), not cannibalizing each other.
- Internal linking: important pages <=3 clicks from home; descriptive anchors; orphan pages have zero rank juice — fix with hub pages.
- Hreflang correct for multi-locale (reciprocal, x-default set).

## 6. Diagnosing a traffic drop
- Timeline-correlate: algorithm update (Search Status Dashboard), deploy (rendering change), or technical breakage (coverage report).
- Segment by page template and query type — a drop in ONE template is a regression you shipped, not an algorithm change.

## Pitfalls
- Client-side-only rendering for the marketing site: invisible to crawlers until the JS budget is perfect, and it never is.
- Meta/OG tags untested: run the URL through the debuggers (Search Console, social previews) before launch, not after.
- Chasing every algorithm rumor while 404s and chains sit unfixed: the technical floor is 80% of the result.
