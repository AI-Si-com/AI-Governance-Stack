# Roadmap: Metadata Replacer

## Overview

A six-phase build from project scaffold through to a production-ready, publicly-hosted client-side metadata tool. Phases follow strict dependency order: the scaffold enables the processing engine; the engine enables device profiles; profiles enable GPS integration; HEIC support requires the full pipeline to be stable; final polish ships the app with trust signals and brand fidelity. Every phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scaffold** - Next.js 16 + TypeScript + Tailwind v4 project with Web Worker harness, Zustand store skeleton, and Vercel deployment configured
- [ ] **Phase 2: Core Metadata Engine** - Upload, preview, and strip metadata pipeline for JPEG, PNG, and WebP with format detection and metadata table UI
- [ ] **Phase 3: Device Profile Registry** - Replace metadata with device-realistic EXIF for phones and professional cameras, including MakerNote blobs, firmware strings, and device-accurate filenames
- [ ] **Phase 4: GPS Location Picker** - Interactive OpenStreetMap location picker that embeds plausible GPS coordinates with altitude, bearing, and consistent timestamps
- [ ] **Phase 5: HEIC Support** - Client-side HEIC decoding via lazy-loaded WASM in the Web Worker with progress indication and memory safety
- [ ] **Phase 6: Trust Signals and Branding** - Privacy trust indicators, Montserrat font, ai-si.com colour palette, and production polish

## Phase Details

### Phase 1: Scaffold
**Goal**: The project foundation exists, deploys to Vercel, and every subsequent phase can build on it without rework
**Depends on**: Nothing (first phase)
**Requirements**: BRAND-03
**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` starts the app locally with no errors
  2. The app deploys to Vercel and is publicly accessible at a live URL
  3. The Web Worker harness is wired up with typed message protocol and ArrayBuffer transfer — a test message round-trips successfully
  4. Zustand AppStore skeleton exists with `file`, `format`, `status`, `selectedProfile`, `gpsLocation`, and `outputBuffer` slots
**Plans**: TBD

Plans: TBD

### Phase 2: Core Metadata Engine
**Goal**: Users can upload any JPEG, PNG, or WebP image, see all its metadata, strip it completely, and download a clean file — with verified forensic completeness
**Depends on**: Phase 1
**Requirements**: PROC-01, PROC-02, PROC-03, PROC-04
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop or click to upload a JPEG, PNG, or WebP image and see a preview of it immediately
  2. User can view a searchable table of all metadata fields found in the uploaded image (EXIF, IPTC, XMP, GPS)
  3. User can click "Strip Metadata" and download a file that ExifTool confirms contains zero metadata — including no MakerNote residuals and no embedded thumbnail
  4. Format detection operates on magic bytes, not file extension — renaming a JPEG to .png is handled correctly
**Plans**: TBD

Plans: TBD

### Phase 3: Device Profile Registry
**Goal**: Users can select a phone or professional camera profile and download a new image whose metadata passes forensic inspection as a genuine device output — with realistic MakerNote, consistent DateTimes, unique serial identifiers, and a device-accurate filename
**Depends on**: Phase 2
**Requirements**: REPL-01, REPL-02, REPL-03, REPL-04, REPL-05, REPL-06
**Success Criteria** (what must be TRUE):
  1. User can search and select a device profile from iPhone, Samsung, Pixel, Nokia, Windows Phone variants, and top 20 professional cameras
  2. After selecting a profile, user can preview all injected metadata fields (firmware, lens, software version, MakerNote, DateTime) before downloading
  3. The downloaded file has a device-accurate filename (e.g., IMG_1234.JPG for iPhone, DSC_0001.JPG for Nikon)
  4. Each downloaded image has a unique ImageUniqueID and BodySerialNumber — two downloads from the same profile produce different identifiers
  5. ExifTool inspection of the output shows a MakerNote block, consistent DateTime/DateTimeOriginal/DateTimeDigitized fields, and a device-specific Software string — not "piexifjs" or empty
**Plans**: TBD

Plans: TBD

### Phase 4: GPS Location Picker
**Goal**: Users can embed a plausible GPS location into replaced-metadata images — with realistic altitude, bearing, consistent timestamps, and correct rational encoding
**Depends on**: Phase 3
**Requirements**: GPS-01, GPS-02, GPS-03
**Success Criteria** (what must be TRUE):
  1. User can click a point on an interactive OpenStreetMap map and have it set as the GPS location for the output image
  2. The embedded GPS data includes a plausible altitude sourced from an elevation API — not zero, not a placeholder
  3. ExifTool inspection shows GPSDateStamp and GPSTimeStamp that match the DateTimeOriginal field in UTC — they are consistent, not contradictory
**Plans**: TBD

Plans: TBD

### Phase 5: HEIC Support
**Goal**: Users can upload HEIC/HEIF images and receive a processed output — with no metadata leakage from conversion, no browser memory leak, and a clear UI disclosure about the output format
**Depends on**: Phase 2
**Requirements**: PROC-05, UX-03
**Success Criteria** (what must be TRUE):
  1. User can upload a HEIC/HEIF file and see it accepted and previewed — not rejected with an error
  2. A progress indicator is visible during HEIC conversion and processing — the UI does not appear frozen
  3. The output file is a valid JPEG with UI disclosure that HEIC was converted — the user is not silently given a renamed file
  4. After processing, browser memory usage does not grow unboundedly across multiple HEIC conversions — the Worker is terminated after each use
**Plans**: TBD

Plans: TBD

### Phase 6: Trust Signals and Branding
**Goal**: The app looks and feels like a trustworthy, polished privacy tool that aligns with the ai-si.com brand — users feel confident their images are safe before they even upload
**Depends on**: Phase 5
**Requirements**: UX-01, UX-02, BRAND-01, BRAND-02
**Success Criteria** (what must be TRUE):
  1. A prominent "Your image never leaves your device" trust indicator is visible on the page before any upload action
  2. No login prompt, account creation, or paywall appears anywhere in the core strip and replace workflow
  3. Montserrat is the visible font throughout the app — not a system fallback
  4. The app uses the ai-si.com colour palette (Deep Navy, Bright Blue, Vibrant Magenta, Light Blue) consistently across buttons, backgrounds, and accents
**Plans**: TBD

Plans: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

Note: Phase 5 depends on Phase 2 (not Phase 4) — GPS and HEIC are independent capabilities that both require the core engine. Phase 5 can begin once Phase 2 is complete; Phase 4 can begin once Phase 3 is complete.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold | 0/TBD | Not started | - |
| 2. Core Metadata Engine | 0/TBD | Not started | - |
| 3. Device Profile Registry | 0/TBD | Not started | - |
| 4. GPS Location Picker | 0/TBD | Not started | - |
| 5. HEIC Support | 0/TBD | Not started | - |
| 6. Trust Signals and Branding | 0/TBD | Not started | - |
