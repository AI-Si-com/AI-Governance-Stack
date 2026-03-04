# Requirements: Metadata Replacer

**Defined:** 2026-03-04
**Core Value:** Users can strip or replace image metadata with device-accurate spoofed data that passes inspection — all without their images ever leaving the browser.

## v1 Requirements

### Image Processing

- [ ] **PROC-01**: User can upload an image via drag-and-drop or click (JPEG, PNG, WebP, HEIC)
- [ ] **PROC-02**: User can preview all metadata found in the uploaded image (searchable table)
- [ ] **PROC-03**: User can strip all EXIF/IPTC/XMP/GPS metadata and download a clean image
- [ ] **PROC-04**: User sees a preview of the uploaded image before processing
- [ ] **PROC-05**: HEIC input is decoded client-side and output as JPEG with disclosure

### Metadata Replacement

- [ ] **REPL-01**: User can select a device profile (iPhone, Samsung, Pixel, Nokia, Windows Phone variants)
- [ ] **REPL-02**: User can select a professional camera profile (top 20 DSLRs/mirrorless)
- [ ] **REPL-03**: Selected device profile injects realistic EXIF including firmware, lens, MakerNote, Software, DateTime fields
- [ ] **REPL-04**: Output filename matches device convention (IMG_1234.HEIC, DSC_0001.JPG, etc.)
- [ ] **REPL-05**: User can preview the injected metadata before downloading
- [ ] **REPL-06**: Each processed image gets a unique ImageUniqueID and BodySerialNumber

### GPS

- [ ] **GPS-01**: User can pick a location on an interactive map (OpenStreetMap)
- [ ] **GPS-02**: Selected location includes plausible altitude (elevation API), bearing, and DMS encoding
- [ ] **GPS-03**: GPS timestamps match the DateTime fields consistently

### UX & Trust

- [ ] **UX-01**: Prominent "Your image never leaves your device" trust indicator
- [ ] **UX-02**: No account required for any functionality
- [ ] **UX-03**: Progress indicator during HEIC conversion and processing

### Branding

- [ ] **BRAND-01**: Montserrat font throughout the app
- [ ] **BRAND-02**: ai-si.com colour palette (Deep Navy, Bright Blue, Vibrant Magenta, Light Blue)
- [ ] **BRAND-03**: Hosted on Vercel

## v2 Requirements

### Batch Processing

- **BATCH-01**: Owner can process multiple images simultaneously (auth-gated)
- **BATCH-02**: Owner can apply same device profile to all images in batch

### Enhanced Features

- **ENH-01**: Before/after metadata diff view (side-by-side comparison)
- **ENH-02**: LocalStorage device preference (remembers last used profile)
- **ENH-03**: Expanded device profile library with additional variants

### Authentication

- **AUTH-01**: Owner login for batch processing access
- **AUTH-02**: Session management for authenticated owner

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video metadata stripping | High complexity, different codecs, dilutes product focus |
| Mobile native app | Web-first; browser handles all target use cases |
| Server-side processing | Contradicts core privacy value proposition |
| Manual EXIF field editing | Different UX paradigm; theXifer.net serves this market |
| AI-generated image detection | Not a privacy tool feature; technically unreliable |
| Social media platform presets | Platforms change behaviour constantly; false precision |
| Copyright/watermark embedding | Different audience, conflicting goals with privacy mission |
| AVIF/TIFF RAW support | Defer until HEIC pipeline is stable |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROC-01 | Phase 2 | Pending |
| PROC-02 | Phase 2 | Pending |
| PROC-03 | Phase 2 | Pending |
| PROC-04 | Phase 2 | Pending |
| PROC-05 | Phase 5 | Pending |
| REPL-01 | Phase 3 | Pending |
| REPL-02 | Phase 3 | Pending |
| REPL-03 | Phase 3 | Pending |
| REPL-04 | Phase 3 | Pending |
| REPL-05 | Phase 3 | Pending |
| REPL-06 | Phase 3 | Pending |
| GPS-01 | Phase 4 | Pending |
| GPS-02 | Phase 4 | Pending |
| GPS-03 | Phase 4 | Pending |
| UX-01 | Phase 6 | Pending |
| UX-02 | Phase 6 | Pending |
| UX-03 | Phase 5 | Pending |
| BRAND-01 | Phase 6 | Pending |
| BRAND-02 | Phase 6 | Pending |
| BRAND-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
