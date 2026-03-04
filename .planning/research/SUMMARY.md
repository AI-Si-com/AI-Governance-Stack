# Project Research Summary

**Project:** Metadata Replacer — client-side image metadata manipulation web app
**Domain:** Browser-based EXIF/metadata privacy and spoofing tool
**Researched:** 2026-03-04
**Confidence:** HIGH (core stack and architecture), MEDIUM-HIGH (stack versions), HIGH (features and pitfalls)

## Executive Summary

This is a browser-based privacy tool that strips and replaces image metadata (EXIF, IPTC, XMP, GPS) without any server involvement. The primary differentiator — device-realistic metadata replacement — is an uncontested niche: no browser-based competitor offers convincing multi-device profiles with accurate firmware strings, MakerNote blobs, and device-correct filenames. The recommended stack is Next.js 16 + React 19 + TypeScript 5 + Tailwind v4 + shadcn/ui, with exifr for reading, piexifjs for JPEG writing, heic-to for HEIC conversion, and react-leaflet for GPS picking. All processing runs in a Web Worker to keep the UI responsive during HEIC decoding and binary manipulation.

The architecture is clean and well-defined: a Read-Transform-Write pipeline feeds into a static device profile registry, with a Zustand store coordinating state between UI components and the processing worker. The most important architectural constraint is that piexifjs is JPEG-only — PNG and WebP metadata writing requires custom binary chunk manipulation — and HEIC output requires a 2.7 MB WASM bundle that must be lazy-loaded. These are known, solvable constraints, not blockers.

The dominant risk category is forensic credibility. Spoofed images that pass visual inspection will fail any automated forensic check if: (1) MakerNote blobs are absent, (2) DateTime fields are inconsistent or reflect the processing timestamp, (3) GPS altitude is missing or implausible, or (4) ImageUniqueID is static across outputs. These pitfalls are well-documented and have clear mitigations, but they require deliberate implementation — they will not be solved by accident. Ship nothing labelled "realistic spoofing" until the MakerNote, DateTime, and ImageUniqueID checklist items are verified with ExifTool.

---

## Key Findings

### Recommended Stack

The stack is modern, production-ready, and well-suited to this domain. Next.js 16 with Turbopack and the App Router provides SSR for the public landing page (SEO matters for a privacy tool) while allowing `'use client'` boundaries for all browser-only processing. The metadata library pairing of exifr (read-only, fastest HEIC parser, 772k weekly downloads) and piexifjs (JPEG write, unmaintained but stable — the JPEG binary format is frozen) is the only production-viable combination available in the browser today. heic-to (actively maintained, tracks libheif releases) is the correct HEIC decoder choice over the abandoned heic2any.

One critical constraint to carry into planning: piexifjs is JPEG-only. All outputs involving metadata injection must be JPEG, regardless of input format. This must be communicated in the UI and shapes the PNG/WebP feature scope for v1.

**Core technologies:**
- **Next.js 16 + React 19:** Framework and routing — SSR for landing page, `'use client'` for processing; Turbopack now stable
- **TypeScript 5:** Type safety — device profile data structures and EXIF field dictionaries are deeply nested; types are mandatory
- **Tailwind v4 + shadcn/ui:** Styling and components — zero runtime overhead, Tailwind v4 native, no config file needed
- **exifr 7.1.3:** Metadata reading — supports JPEG/PNG/HEIC/WebP/XMP/GPS; read-only; fastest available (~30x faster than alternatives on HEIC)
- **piexifjs 1.0.6:** Metadata writing — only mature JS library for writing structured EXIF back into JPEG binary; JPEG-only
- **heic-to 1.4.2:** HEIC decoding — actively maintained, browser-first, tracks libheif 1.21.2
- **react-leaflet 5.x + OpenStreetMap:** GPS location picker — no API key required, React 19 compatible, click event exposes lat/lng directly
- **Zustand:** App state — single store for file, profile, GPS, output; no Redux needed for this scope
- **Web Worker:** Processing isolation — HEIC decoding and binary manipulation off the main thread; ArrayBuffer transfer (zero-copy)

### Expected Features

No browser-based competitor offers device-realistic metadata replacement with accurate firmware strings, MakerNote blobs, lens profiles, and device-correct filenames. MetaSpoof comes closest but is server-side and offers only basic iPhone/Android without granular variant accuracy. This is the uncontested differentiation zone that justifies building this product.

**Must have (table stakes):**
- Strip all metadata (EXIF/IPTC/XMP/GPS) — every competitor does this; missing it means the product feels incomplete
- Preview metadata before stripping — searchable table is the pattern (exifremover.com); trust signal
- Drag-and-drop upload with visible drop zone — expected on any modern file tool
- JPEG, PNG, WebP, HEIC input support — covers the full smartphone and desktop photo landscape
- Download processed image with correct filename — nothing to do without it
- "Your image never leaves your device" trust indicator — privacy tool users are specifically looking for this
- No account required, free core function — set expectation by all competitors

**Should have (differentiators):**
- Replace with device-realistic metadata — the core differentiator; no competitor does this at quality; high complexity, P1
- Device profile library (phones + cameras) — iPhone, Samsung, Pixel, Nokia, Windows Phone, top 20 pro cameras; must precede replacement feature
- GPS location picker (map-based, OpenStreetMap) — plausible geographic embedding rather than blank or real GPS
- Device-accurate output filename — IMG_1234.HEIC for iPhone, DSC_0001.JPG for Nikon; no competitor does this
- Metadata preview after replacement — shows spoofed fields as trust signal before download
- Before/after metadata diff view — side-by-side original vs replacement; unique to this product (v1.x)

**Defer (v2+):**
- Batch processing (owner-only, auth-gated) — explicitly deferred per PROJECT.md
- User accounts — depends on batch feature decision
- AVIF/TIFF RAW support — defer until HEIC pipeline is stable
- Video metadata stripping — out of scope; dilutes product focus

### Architecture Approach

The architecture is a clean Read-Transform-Write pipeline running inside a Web Worker. The UI (FileDropzone, DeviceSelector, LocationPicker, PreviewPanel) communicates with a Zustand store. The store orchestrates the worker. The worker runs: format detection from magic bytes → HEIC decode (lazy-loaded WASM, only if HEIC detected) → metadata read (exifr, for diff display) → metadata write (piexifjs for JPEG, custom chunk writers for PNG/WebP) → return ArrayBuffer. Device profiles are static JSON bundled at build time, split by category (phones vs cameras) for lazy loading. The download generator creates a Blob URL on the main thread (not in the worker) and triggers anchor click with the device-profile filename.

**Major components:**
1. **FileDropzone** — HTML5 File API drag-and-drop; validates format via magic bytes; passes ArrayBuffer to Zustand store
2. **DeviceSelector** — searches bundled device profile JSON; emits selected DeviceProfile object to store
3. **LocationPicker** — react-leaflet map; user clicks to set lat/lng; writes to store; triggers elevation API call on confirm
4. **Processing Pipeline (Web Worker)** — format router → HEIC decoder (lazy) → metadata reader → metadata writer (format-aware); receives ArrayBuffer, returns ArrayBuffer
5. **Device Profile Registry** — static JSON per brand/category, bundled at build; profileResolver.ts handles search and ExifPayload construction
6. **Zustand AppStore** — single store: `file`, `format`, `existingMetadata`, `selectedProfile`, `gpsLocation`, `outputBuffer`, `status`
7. **DownloadGenerator** — Blob → URL.createObjectURL → anchor click → revokeObjectURL; filename from profile pattern

### Critical Pitfalls

1. **Incomplete metadata stripping — MakerNote and thumbnail residuals** — piexifjs strips only named IFD tags; proprietary MakerNote binary and the embedded JPEG thumbnail survive. Fix: remove the entire APP1 marker segment from the JPEG binary before reinserting only the desired tags. Verify with ExifTool, not just the read library.

2. **Missing MakerNote in spoofed output — forensic tell** — Every genuine iPhone, Samsung, Pixel, and DSLR photo contains a proprietary MakerNote block; its absence is immediately detectable by ExifTool and FotoForensics. Fix: source real MakerNote binary blobs for each device profile from sample photos and inject verbatim, adjusting pointer offsets. This is non-negotiable for the core differentiator.

3. **DateTime and Software fields exposing processing identity** — Using `new Date()` for DateTime fields leaks the exact spoofing moment. Leaving Software as "piexifjs" or empty is a direct fingerprint. Fix: centralise DateTime generation using user-supplied or plausible-random time; set all five time fields consistently (DateTime, DateTimeOriginal, DateTimeDigitized, GPSDateStamp, GPSTimeStamp); Software must be the device-specific string (iOS version, firmware version).

4. **GPS implausibility — altitude, bearing, rational encoding** — GPS that lacks altitude (altitude=0 for Denver is immediately wrong), GPSImgDirection (absent in 95%+ of genuine iPhone photos), or uses uniform rational denominators is detectable. Fix: integrate elevation API keyed to picker coordinates; generate random bearing; use variable-denominator rational encoding matching chipset patterns.

5. **HEIC pipeline — metadata loss during conversion, WASM memory leak** — heic2any/heic-to does not copy metadata from source HEIC to output JPEG; the 70 MB Worker memory leak in heic2any is a documented GitHub issue. Fix: read EXIF from the HEIC ArrayBuffer with exifr before conversion; use heic-to (actively maintained); terminate the Worker after each conversion.

---

## Implications for Roadmap

Based on the architecture build order in ARCHITECTURE.md, the feature dependencies in FEATURES.md, and the phase-to-pitfall mapping in PITFALLS.md, the following phase structure is recommended:

### Phase 1: Project Scaffold and Toolchain
**Rationale:** Everything depends on this being stable. No features can be built without the project skeleton.
**Delivers:** Working Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui project; Zustand store skeleton; ESLint/Prettier/Vitest configured; Web Worker harness with typed message protocol.
**Addresses:** None of the user features yet, but establishes the `status: 'idle' | 'processing' | 'done' | 'error'` flow and ArrayBuffer transfer pattern that every subsequent phase depends on.
**Avoids:** Workers created lazily, not eagerly — the harness should support lazy WASM import from day one to avoid the heic2any eager-load anti-pattern.

### Phase 2: Core Metadata Engine (JPEG + PNG + WebP)
**Rationale:** ARCHITECTURE.md build order makes format detection and JPEG writing the unblocking foundation for all metadata features. This phase must be complete and verified before device profiles add value.
**Delivers:** Format detection from magic bytes; exifr metadata reading; piexifjs JPEG strip/write pipeline; custom PNG chunk writer (tEXt, iTXt, eXIf wholesale removal); custom WebP RIFF chunk writer; metadata preview table (shared UI component used in both strip and replace flows).
**Addresses:** Strip all metadata (P1), Preview metadata before action (P1), JPEG/PNG/WebP support (P1).
**Avoids:** Pitfall 1 (incomplete stripping) — verified with ExifTool against output from all three formats with known MakerNote, thumbnail, and XMP payloads before the phase is closed. Pitfall 8 (PNG/WebP chunk coverage) — test matrix: PNG with iTXt, PNG with eXIf, WebP with EXIF chunk.

### Phase 3: Device Profile Registry and Replacement Engine
**Rationale:** The core differentiator. FEATURES.md identifies this as P1 despite high complexity because it is the reason the product exists. ARCHITECTURE.md confirms it must follow the metadata engine (profile data drives ExifPayload types). PITFALLS.md identifies MakerNote, DateTime, and ImageUniqueID as critical correctness requirements that must be built in from the start, not retrofitted.
**Delivers:** DeviceProfile TypeScript schema; phone JSON profiles (iPhone, Samsung, Pixel, Nokia, Windows Phone) with real MakerNote binary blobs per variant; DSLR/mirrorless profiles (top 20); profileResolver.ts with fuzzy search; JPEG replace pipeline using device ExifPayload; DeviceSelector UI component; device-accurate output filename generation; per-output random ImageUniqueID and BodySerialNumber; correct Software, DateTime, and firmware fields per profile.
**Addresses:** Replace with device-realistic metadata (P1), Device-accurate filename (P1), Metadata preview after replacement (P1).
**Avoids:** Pitfall 2 (missing MakerNote) — each profile ships with MakerNote blob; Pitfall 6 (Software/DateTime tells) — centralised DateTime generator, all five time fields, device-specific Software string; Pitfall 7 (ImageUniqueID collision) — per-output crypto.getRandomValues.

### Phase 4: GPS Location Picker
**Rationale:** Enhances the replacement feature but does not block it. Can ship a device profile replacement with a plausible default city-level GPS if the picker is not ready. PITFALLS.md flags elevation API as essential from the start — do not build the picker without altitude.
**Delivers:** react-leaflet LocationPicker component (dynamic import with ssr:false); elevation API integration (Open-Meteo or equivalent, debounced, cached); GPS formatter utility (decimal degrees to EXIF DMS rational with variable denominators); GPSImgDirection random bearing; GPSAltitudeRef; GPSTimeStamp matching DateTimeOriginal in UTC; default picker location (not null island).
**Addresses:** GPS location picker (P1).
**Avoids:** Pitfall 3 (GPS implausibility) — altitude, bearing, and rational encoding all addressed; default picker prevents null-island (0,0) output.

### Phase 5: HEIC Input Support
**Rationale:** ARCHITECTURE.md places HEIC last in build order because it has the highest complexity and depends on the Worker harness being solid. PITFALLS.md identifies two critical HEIC-specific failure modes (metadata loss during conversion, WASM memory leak) that require the pipeline to be designed around HEIC from the start.
**Delivers:** heic-to lazy-loaded inside the Web Worker (triggered only when magic bytes confirm HEIC); explicit exifr read from HEIC ArrayBuffer before conversion; Worker termination after conversion to prevent 70 MB memory leak; file size guard (50 MB client-side limit with user-friendly error); pixel dimension decompression bomb guard; HEIC input labelled as "output: JPEG" in UI if true HEIC encoding is deferred.
**Addresses:** HEIC/HEIF input support (P1), file size guard (security).
**Avoids:** Pitfall 4 (HEIC metadata loss during conversion pipeline); Pitfall 5 (HEIC magic byte mismatch — explicit choice documented in UI); HEIC WASM memory leak (Worker termination pattern).

### Phase 6: UI Polish and Trust Signals
**Rationale:** Core product is functionally complete after Phase 5. This phase addresses the UX pitfalls (no progress indicator, GPS defaulting to null island, no trust signal), before/after metadata diff view (v1.x), and production hardening.
**Delivers:** HEIC progress spinner during WASM processing; prominent "Never leaves your device" trust badge adjacent to upload zone; before/after metadata diff view (MetadataDiff.tsx); LocalStorage device preference for returning users; Montserrat font via next/font; colour palette tokens; Object URL revoke after download click; Content-Type validation on upload (magic bytes, not extension); XSS sanitisation of any user-supplied strings embedded in EXIF.
**Addresses:** Before/after diff view (P2), LocalStorage device preference (P2), UX pitfalls from PITFALLS.md.
**Avoids:** UX pitfall: HEIC conversion with no progress indicator; UX pitfall: GPS picker defaulting to null island; security: pixel flood attack; security: XSS via EXIF fields.

### Phase Ordering Rationale

- **Phases 1 → 2 → 3** are strict sequential dependencies: scaffold enables the engine; the engine enables profiles.
- **Phase 4 (GPS)** can be started in parallel with late Phase 3 work since it depends only on the formatter utility and a working ExifPayload schema, not on the full profile library being complete.
- **Phase 5 (HEIC)** is deliberately last because it requires the Worker harness (Phase 1), the metadata engine (Phase 2), and the profile replace pipeline (Phase 3) to all be stable. Attempting HEIC earlier risks compounding instability.
- **Phase 6 (Polish)** is non-blocking for launch but must include the "Looks Done But Isn't" checklist items from PITFALLS.md before any public promotion of the spoofing capability.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Device Profile Registry):** MakerNote binary injection is the most technically niche aspect of the project. Sourcing real MakerNote blobs for each device variant, understanding pointer offset adjustment when inserting into a new EXIF structure, and testing against forensic tools needs specific planning. Recommend a `/gsd:research-phase` pass specifically on MakerNote injection mechanics and available sample photo datasets.
- **Phase 5 (HEIC):** The heic-to library changelog and the specific Worker termination pattern for libheif-wrapped libraries may need validation during planning. The v1 decision on true HEIC output vs JPEG-renamed-as-HEIC needs an explicit architectural decision record.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Scaffold):** create-next-app with the listed flags is a single command; Tailwind v4 + shadcn/ui is well-documented.
- **Phase 2 (Metadata Engine for JPEG/PNG/WebP):** piexifjs write pipeline and custom PNG/WebP chunk removal are documented in ARCHITECTURE.md with sufficient detail for direct implementation.
- **Phase 4 (GPS Picker):** react-leaflet v5 + OpenStreetMap + `dynamic + ssr:false` pattern is well-documented; Open-Meteo elevation API is a simple GET request.
- **Phase 6 (Polish):** Standard UI work; no novel integrations.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core library choices verified via npm and GitHub; Next.js 16 version number from nextjs.org/blog; piexifjs unmaintained but JPEG format is frozen — stable by definition |
| Features | HIGH | Based on direct competitor analysis of 6 tools; uncontested differentiation zone confirmed by absence in all competitors |
| Architecture | HIGH | Core pipeline (Read-Transform-Write, Web Worker isolation, static profiles) is well-established; HEIC handling marked MEDIUM by researcher due to heic-to being relatively new |
| Pitfalls | HIGH | All critical pitfalls verified across multiple independent sources including Black Hat research, FotoForensics documentation, and confirmed GitHub issues |

**Overall confidence:** HIGH

### Gaps to Address

- **MakerNote binary sourcing:** Research confirms MakerNote injection is required, but the practical pipeline for sourcing and injecting real per-device MakerNote blobs is not fully specified. Phase 3 planning needs a `/gsd:research-phase` on this specifically: where to source reference photos (EXIF sample datasets), how to extract the MakerNote binary, and the pointer offset adjustment mechanics when inserting into a new EXIF IFD structure.
- **Elevation API selection:** PITFALLS.md recommends Open-Meteo or Google Elevation API but does not specify which. For production use the rate limits, caching strategy, and offline behaviour need to be decided in Phase 4 planning. Open-Meteo is free and open-source; Google requires billing above free tier.
- **True HEIC output decision:** The v1 choice between (a) always outputting JPEG with disclosure, (b) always outputting true HEIC via libheif-js WASM encoder, or (c) offering user choice must be made as an explicit architectural decision record before Phase 5. PITFALLS.md flags that silently renaming JPEG as .HEIC is unacceptable. STACK.md recommends documenting the JPEG output limitation in the UI.
- **piexifjs DataURL vs ArrayBuffer workflow:** piexifjs works with binary strings and DataURL, not ArrayBuffer natively. The wrapper code to bridge from ArrayBuffer (Worker input) to DataURL (piexifjs input) and back needs to be designed explicitly in Phase 2 — the `btoa/atob` path mentioned in STACK.md has size limits in some browsers.

---

## Sources

### Primary (HIGH confidence)
- GitHub: MikeKovarik/exifr — exifr 7.1.3, read-only, HEIC support, performance benchmarks confirmed
- GitHub: hMatoba/piexifjs — 1.0.6, JPEG write confirmed, last published ~7 years ago, stable
- npm: heic-to@1.4.2 — actively maintained, libheif 1.21.2, browser-first (published ~Feb 2026)
- GitHub: PaulLeCam/react-leaflet — v5.0.0, React 19 peer dep confirmed, SSR limitation confirmed
- nextjs.org/blog — Next.js 16 released, Turbopack stable, React 19.2
- MDN: HTMLCanvasElement.toBlob() — metadata stripping behaviour confirmed
- MDN: Blob — Blob URL lifecycle and revokeObjectURL
- FotoForensics Metadata Tutorial — what forensic analysts look for; MakerNote absence flagged
- Black Hat 2017: Mazurov — Counter-forensics techniques, MakerNote analysis
- ExifTool GPS Tags Reference — GPS field specs, rational encoding
- Exiv2 MakerNote Reference — MakerNote proprietary formats by manufacturer

### Secondary (MEDIUM confidence)
- ui.shadcn.com/docs/tailwind-v4 — Tailwind v4 support confirmed, React 19 components updated
- Handling HEIC on the Web (Upside Lab) — heic2any/heic-to limitations, metadata loss during conversion
- heic2any GitHub Issue #30 — 70 MB Worker retention bug confirmed
- Auth0: Read, Edit, Erase Location with piexifjs — piexifjs write pipeline confirmed
- Web Workers + React + TypeScript (LogRocket) — Worker message protocol patterns
- ISACA: EXIF Data as Cybersecurity Risk (2025) — current privacy risk landscape

### Tertiary (MEDIUM confidence, community sources)
- Competitor analysis: VerExif, ExifRemover, theXifer.net, MetaSpoof, MyLittleTools — feature gap analysis; direct inspection
- EXIFData.org: Detect Fake EXIF Data — Software field tells, quantisation matrix detection
- Design Rule for Camera File System (Wikipedia) — DCF filename convention standards
- Pixel Flood Attack HackerOne Report — decompression bomb via image dimensions

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
