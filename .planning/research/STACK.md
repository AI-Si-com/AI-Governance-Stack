# Stack Research

**Domain:** Client-side image metadata manipulation web app
**Researched:** 2026-03-04
**Confidence:** MEDIUM-HIGH (core libraries verified via npm search and official sources; version numbers cross-checked where accessible)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x (latest stable) | Framework + routing | Native Vercel hosting with zero config, SEO matters for a public privacy tool, App Router handles "use client" cleanly for browser-only processing, Turbopack now stable default bundler |
| React | 19.x | UI library | Required peer dep for Next.js 16; View Transitions API support now stable in React 19.2 via canary |
| TypeScript | 5.x | Type safety | Required for device profile data structures; EXIF field dictionaries are deeply nested and error-prone without types |
| Tailwind CSS | v4.x | Styling | Works with Next.js 15/16 + shadcn/ui; no config file needed in v4; OKLCH colours map well to the ai-si.com palette |
| shadcn/ui | latest (Tailwind v4 branch) | Component library | Unstyled primitives that are fully customisable to the brand palette; no external stylesheet; works with Tailwind v4 and React 19 |

### Metadata Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| exifr | 7.1.3 | Read EXIF/IPTC/XMP/GPS from JPEG, PNG, HEIC, WebP | 772k weekly downloads; fastest reader (~30x faster than alternatives on HEIC); supports ALL segments needed (TIFF, XMP, IPTC, JFIF, GPS, ICC); browser + Node; READ ONLY |
| piexifjs | 1.0.6 | Write/inject EXIF into JPEG output | Only mature JS library that supports writing structured EXIF back into JPEG binary; covers all IFD sections (0th, Exif, GPS, 1st); 78k weekly downloads. Unmaintained since ~2018 but stable — the JPEG binary format is frozen |
| @types/piexifjs | latest | TypeScript definitions for piexifjs | Community-maintained types; required for TypeScript projects |

### HEIC/HEIF Handling

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| heic-to | 1.4.2 | Decode HEIC/HEIF to JPEG/PNG in browser | Actively maintained (published ~15 days ago as of research date); tracks libheif releases (currently libheif 1.21.2); pure browser, no server needed. Preferred over heic2any which is abandoned |

### Map / Location Picker

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| react-leaflet | 5.x | Map rendering + click-to-pick GPS coordinates | Free, no API key required with OpenStreetMap tiles; v5 supports React 19; lightweight (~42 KB); click event exposes `e.latlng` directly |
| leaflet | 1.9.x | Core map engine (peer dep of react-leaflet) | Industry standard open-source map library |
| @types/leaflet | latest | TypeScript definitions | Required for type-safe lat/lng handling |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| browser-image-compression | latest | Compress before/after processing | Use if output file size exceeds original after EXIF injection; optional |
| file-saver | latest | Trigger browser download with correct filename | Use for the "Download" button; handles Safari quirks with `a.download` |
| @types/file-saver | latest | TypeScript types | Always when using file-saver |
| clsx | latest | Conditional className merging | Standard with shadcn/ui; always include |
| tailwind-merge | latest | Merge Tailwind classes without conflicts | Required companion to clsx for shadcn/ui |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | Linting | Use Next.js built-in config; `next lint` command |
| Prettier | Code formatting | Add `prettier-plugin-tailwindcss` to auto-sort class names |
| Vitest | Unit testing | Vite-native, fast, works in Next.js projects via `@vitejs/plugin-react` |
| next/dynamic | SSR guard for Leaflet | Leaflet calls `window`/`document` on import — always wrap map component with `dynamic(() => import(...), { ssr: false })` |

---

## Installation

```bash
# Create project
npx create-next-app@latest metadata-replacer --typescript --tailwind --eslint --app

# Metadata reading and writing
npm install exifr piexifjs
npm install -D @types/piexifjs

# HEIC conversion
npm install heic-to

# Map picker
npm install react-leaflet leaflet
npm install -D @types/leaflet

# UI utilities
npm install shadcn@latest  # then: npx shadcn init
npm install clsx tailwind-merge file-saver
npm install -D @types/file-saver prettier prettier-plugin-tailwindcss

# Testing
npm install -D vitest @vitejs/plugin-react
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 | Vite + React SPA | If SEO is irrelevant (behind auth gate). For this project, the public landing page and tool page benefit from SSR/static generation for discoverability |
| piexifjs | exiv2-wasm | If you need full XMP/IPTC write support (not just EXIF). exiv2-wasm exists in experimental form but is not production-ready for browser use as of 2026 |
| react-leaflet + OSM | Google Maps / Mapbox | Only if you need address search / geocoding. Google Maps requires billing; Mapbox requires an API key. OSM is free and sufficient for click-to-pick coordinates |
| heic-to | heic2any | heic2any last updated 2020, abandoned. heic-to is actively tracking libheif releases |
| heic-to | libheif-js directly | libheif-js (v1.19.8) requires more boilerplate; heic-to is the user-friendly wrapper around it |
| shadcn/ui | Mantine / Chakra | shadcn/ui has zero runtime overhead, is fully Tailwind-native, and is the de facto standard for Next.js in 2025-26 |
| Tailwind v4 | Tailwind v3 | v3 still works, but new shadcn/ui components ship v4-native. Avoid mixing |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| exif-js | Read-only, abandoned (last release ~2017), no HEIC support, widespread browser bugs | exifr for reading |
| ExifReader | Read-only; no write support despite broad format coverage | exifr (read) + piexifjs (write) |
| sharp | Node.js / server-side only; does not run in browser without a server. wasm-vips port exists but is 8x slower than server-side sharp and adds 10+ MB WASM bundle | Canvas API + heic-to for client-side processing |
| Canvas `toBlob()` alone for JPEG output | Canvas strips ALL metadata on re-encode — cannot preserve or inject EXIF. Fine for stripping but not for metadata replacement | piexifjs `insert()` to inject EXIF into the final JPEG binary |
| Mapbox GL JS | Requires API key and paid plan above free tier; proprietary after 2020 licence change | react-leaflet + OpenStreetMap |
| MapLibre GL JS | More powerful but heavier than needed for a simple coordinate picker | react-leaflet (simpler API, sufficient for lat/lng picking) |
| react-leaflet-location-picker | Last release ~1 year ago, not actively maintained, restricted to older react-leaflet API | Build a thin custom component using react-leaflet v5's `useMapEvents` hook directly |

---

## Stack Patterns by Variant

**For JPEG input (most common):**
- Read with `exifr.parse(file, { tiff: true, xmp: true, iptc: true, gps: true })`
- Build replacement EXIF object using piexifjs IFD structure
- Strip by re-encoding via Canvas `toBlob()` (Canvas strips all metadata automatically)
- Replace by loading original binary, calling `piexif.remove()` then `piexif.insert(newExifStr, jpegBinary)`
- Output: JPEG binary via `file-saver`

**For HEIC/HEIF input (iPhone originals):**
- Decode to JPEG first via `heic-to` → `convert({ blob, type: 'image/jpeg', quality: 0.95 })`
- Read metadata from original HEIC with `exifr` before conversion (HEIC EXIF survives conversion step in heic-to)
- Then apply same JPEG pipeline above
- Output: JPEG (iPhone devices expect `.HEIC` filename but the app outputs JPEG — clarify in UI)

**For PNG/WebP input:**
- `exifr` reads EXIF from PNG and WebP
- Stripping: Canvas `toBlob()` with appropriate mime type strips metadata
- Replacing: piexifjs is JPEG-only — must convert PNG/WebP to JPEG for metadata injection, OR output stripped PNG/WebP without replacement metadata (document this limitation)

**For GPS location embedding:**
- Convert decimal degrees from react-leaflet `e.latlng` to DMS rational format required by piexifjs
- Helper: `decimalToDMS(decimal)` returns `[[deg, 1], [min, 1], [sec * 100, 100]]`
- Set both `GPSLatitude`/`GPSLongitude` and `GPSLatitudeRef`/`GPSLongitudeRef`

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-leaflet@5.x | leaflet@1.9.x, React@19.x | Leaflet 2.x not yet released; pin to leaflet 1.9.x |
| heic-to@1.4.2 | libheif@1.21.2 (bundled) | No external libheif peer dep needed |
| piexifjs@1.0.6 | All modern browsers | JPEG-only; binary string manipulation, not ArrayBuffer. Wrap with `btoa/atob` for DataURL workflow |
| exifr@7.1.3 | Next.js 16, React 19, browser + Node | Full bundle needed for HEIC; use lite bundle for JPEG-only paths |
| shadcn/ui (Tailwind v4 branch) | Tailwind@4.x, Next.js 15/16, React@19 | Do NOT mix with Tailwind v3; v4 uses CSS-native `@theme` — no `tailwind.config.js` |
| react-leaflet@5.x + Next.js | Next.js@16 | MUST use `dynamic(() => import('./MapComponent'), { ssr: false })` — Leaflet uses `window` on import and breaks SSR |

---

## Critical Architecture Note: PNG/WebP Metadata Write Limitation

piexifjs is JPEG-only. For PNG and WebP inputs where the user wants metadata replacement (not just stripping), the app must either:

1. Convert the output to JPEG (loses lossless PNG quality; acceptable for most users)
2. Display a notice that metadata replacement outputs JPEG regardless of input format
3. Defer PNG/WebP replacement to a future phase using a more capable library (exiv2-wasm when mature)

**Recommendation:** Convert all outputs to JPEG when replacing metadata. Use Canvas `toBlob('image/jpeg', 0.95)` then pipe through piexifjs. Make this explicit in the UI ("Output: JPEG").

---

## Sources

- GitHub: MikeKovarik/exifr — exifr README, version 7.1.3 confirmed, HEIC support confirmed, read-only confirmed
- GitHub: hMatoba/piexifjs — version 1.0.6, JPEG write confirmed, last published ~7 years ago, stable
- npm: heic-to@1.4.2 — actively maintained, libheif 1.21.2, browser-first confirmed (published ~Feb 2026)
- GitHub: PaulLeCam/react-leaflet — v5.0.0, React 19 peer dep confirmed, SSR limitation confirmed
- nextjs.org/blog — Next.js 16 released, Turbopack stable, React 19.2, proxy.ts replaces middleware.ts
- ui.shadcn.com/docs/tailwind-v4 — Tailwind v4 support confirmed, components updated for React 19 [MEDIUM confidence — official docs]
- MDN: HTMLCanvasElement.toBlob() — metadata stripping behaviour confirmed [HIGH confidence — official spec]
- WebSearch: Vite vs Next.js 2025/2026 comparison — Next.js recommended for public SEO-relevant tools [MEDIUM confidence — multiple sources agree]
- WebSearch: react-leaflet SSR workaround in Next.js — `dynamic + ssr:false` pattern confirmed across multiple independent sources [HIGH confidence]

---

*Stack research for: client-side image metadata manipulation web app*
*Researched: 2026-03-04*
