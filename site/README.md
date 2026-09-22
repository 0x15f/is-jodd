# Oddly Specific

The Cloudflare Pages site for **https://howdoicalculateifanintegerisodd.com**. This subdirectory has its own package and lockfile, independent of the published npm package.

## What is here

- A browser-only odd/even calculator supporting signed decimal integers up to 1,000 digits without floating-point rounding.
- 36 original guides: 12 number fundamentals, 12 programming/spreadsheet tutorials, and 12 Jev/is-jodd articles.
- Category hubs, local article search, code-copy buttons, source links, breadcrumbs, related reading, and a custom 404.
- Static HTML on every route; unique titles/descriptions, canonical links, Article/BreadcrumbList JSON-LD, sitemap.xml, robots.txt, and a bespoke social card.

The calculator does not call Jev, send inputs to a server, or need an API key. No npm or TypeSafe credentials belong in this directory or deployment.

## Local work

Use Node 24 or newer:

```sh
cd site
npm ci
npm run check
npm run dev
```

The local preview is `http://127.0.0.1:4321`. Re-run `npm run build` after source/content edits, then refresh. The static output is `dist/`. `npm run check` runs calculator tests and verifies generated metadata, local links, anchors, article length, structured data, and sitemap coverage.

## Content

Edit `content/learn.json`, `content/code.json`, or `content/jev.json`. Each article has `slug`, `category`, `title`, `description`, `summary`, Markdown `body`, `related` slugs, and `sources` with `title`/`url`. Keep slugs unique and related targets valid. Every indexed article should resolve a distinct question with examples and edge cases, rather than repeat another guide with changed keywords.

Page paths are `/{category}/{slug}/`. The renderer generates HTML and heading anchors. Site origin, category descriptions, and publication date are in `src/config.mjs`; shared pages/templates are in `src/templates.mjs`; styling and browser code are in `public/`.

The current Jev documentation was checked September 22, 2026. Source links are included on each guide. The first-party benchmark is accurately described as finding smaller runtime/request bodies, not a consistent latency advantage. There is no claim that keyword volume or rankings have been measured.

## Cloudflare Pages

- Project: `howdoicalculateifanintegerisodd`
- Account: Palize, Inc (`e56b18ce4c0cf671554cd09cd9b5e6f2`)
- Production branch: `main`
- Build root: `site`
- Build command: `npm run build`
- Output directory: `dist`
- Deployment type: direct upload using Wrangler, with source committed to GitHub.

For later deployments, authenticate Wrangler and run:

```sh
npm run check
CLOUDFLARE_ACCOUNT_ID=e56b18ce4c0cf671554cd09cd9b5e6f2 npm run deploy -- --branch main
```

GitHub CI validates changes but does not deploy automatically. A Cloudflare Single Redirect in the domain's zone sends `www` to the canonical apex domain, preserving the path and query string; its configuration is recorded in `cloudflare-redirect.json`. This is a zone rule because Pages `_redirects` does not support domain-level redirects. `_headers` supplies content/security headers and marks the alternate `pages.dev` hosts `noindex`. Keep the custom domains attached to the Pages project and their CNAME records pointed at `howdoicalculateifanintegerisodd.pages.dev`.

### Country access rule

Cloudflare MCP configured the following on September 22, 2026:

- Zone WAF custom rule `odd_block_il` (`c22d863fb88546a2ae89f00de9269b99`) blocks `(ip.src.country eq "IL" and http.host in {"howdoicalculateifanintegerisodd.com" "www.howdoicalculateifanintegerisodd.com"})` in ruleset `81de4fa98cf54d4a8131c99d4afbce58`.
- Account Bulk Redirect list `odd_pages_canonical` (`300fe45958fe43c1a07fd407739eb975`) routes `howdoicalculateifanintegerisodd.pages.dev/` and its subdomains to `https://howdoicalculateifanintegerisodd.com/` with a 301, preserving paths and query strings. Rule `odd_pages_canonical_redirect` (`d36ca62dbd124193914613e0f8b8dbd1`) enables the list. Deployment and branch URLs therefore lead to production content, where the WAF rule applies.
- Verification: Cloudflare Trace with country `IL` matched the block and returned 403; `US` did not match and returned 200. Live HTTPS checks confirmed the production Pages address and both existing deployment addresses redirect with paths and queries intact.

The block uses IP geolocation. Existing account-wide IP Allow rules remain in place and can bypass WAF custom rules. To remove this restriction, disable `odd_block_il` in the zone's WAF custom rules; the canonical redirects can remain. These settings live in Cloudflare and persist independently of Pages deployments. See Cloudflare's [country blocking guidance](https://developers.cloudflare.com/waf/custom-rules/use-cases/block-traffic-from-specific-countries/) and [Pages redirect recipe](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/).

Submit `https://howdoicalculateifanintegerisodd.com/sitemap.xml` in the domain's search-console property when available. A working sitemap does not mean the pages have already been indexed.

## Social preview asset

`public/og.png` is a 1730 × 909 image generated once with the built-in imagegen tool and inspected for text accuracy. Prompt: editorial paper-and-ink card using paper #f5f3eb, ink #22231e, orange #e9532c, and lime #d8ee86; Georgia-like headline and Helvetica labels; exact text “oddly specific.”, “Is it odd?”, and “A small question. An entire website.”; three lime-backed pairs of counters plus one orange leftover; no browser chrome or extra logos.
