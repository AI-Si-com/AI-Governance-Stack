# Feature Research

**Domain:** Image metadata privacy and spoofing — browser-based web app
**Researched:** 2026-03-04
**Confidence:** HIGH (based on direct competitor analysis + user behavior research)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Strip all metadata (EXIF/IPTC/XMP) | Every competitor does this; it's the entry-level use case | LOW | Must remove GPS, camera info, timestamps, software tags, thumbnail previews |
| Preview metadata before stripping | Users want to see what they're removing (trust signal) | LOW | Table/list of fields found; searchable preferred (exifremover.com pattern) |
| Drag-and-drop upload | Expected on any modern file tool; click-to-upload alone feels dated | LOW | With visible drop zone |
| Download processed image | Obvious — nothing to do without it | LOW | Trigger browser download with correct filename |
| Client-side processing badge/claim | Users selecting privacy tools are specifically looking for "no upload" assurance | LOW | Prominent UI copy: "Your image never leaves your device" |
| JPEG support | JPEG is 90%+ of user-submitted photos | LOW | Universally expected |
| PNG support | Second most common format; expected | LOW | Must preserve transparency |
| Show original image preview | Users need to confirm they uploaded the right file | LOW | Thumbnail display after upload |
| No account required | Privacy tool users are specifically avoiding account creation | LOW | No registration gate for core function |
| Free to use (core function) | Existing tools set free-as-default expectation | LOW | Monetization behind batch or premium tiers |
| GPS removal specifically called out | GPS is the primary privacy concern users articulate; it needs to be named, not just implied | LOW | Marketing copy + confirmation in output |

### Differentiators (Competitive Advantage)

Features that set the product apart. Competitors are weak or absent here.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Replace with device-realistic metadata | No browser-based competitor does convincing full-profile replacement; existing spoofers (MetaSpoof, MyLittleTools) are rudimentary or server-side | HIGH | Core differentiator per PROJECT.md — must be high fidelity: real firmware strings, accurate lens data, correct MakerNote structure per device |
| Device profile library (phones + cameras) | Users who want plausible spoofing need real device signatures, not generic "Camera X" | HIGH | iPhone variants, Samsung variants, Pixel variants, Nokia, Windows Phone, top 20 pro cameras — with model-accurate EXIF fields per variant |
| GPS location picker (map-based) | Allows embedding a plausible geographic location rather than blank GPS or real coordinates | MEDIUM | Interactive map (OpenStreetMap preferred — no API key dependency); click to place, confirm coordinates embedded |
| Device-accurate output filename | Passing inspection means the filename matches the device (IMG_1234.HEIC for iPhone, DSC_0001.JPG for Nikon) — no competitor does this | MEDIUM | Filename generation using device-correct prefix + sequential pattern |
| HEIC/HEIF input support | iPhone is the dominant phone camera; HEIC is the default iPhone format since iOS 11; most web tools don't handle it client-side | HIGH | Requires browser-based HEIC parsing (exifr library is fastest at ~0.2-0.3ms vs alternatives) |
| WebP input support | Growing format from Android and Chrome screenshots; gaps in competitor support | MEDIUM | Standard canvas pipeline handles this |
| Metadata preview after replacement | Users want confidence that the replacement metadata looks legitimate — showing the spoofed fields is the trust signal | LOW | Same preview UI as strip, but now showing the injected fake fields |
| "What gets changed" summary | Side-by-side: original metadata → replacement metadata — unique to this product | MEDIUM | Before/after diff view; reinforces the realism claim |
| No server, verifiable claim | Open-source or DevTools-verifiable client-only processing differentiates from MetaSpoof (server-side) and theXifer.net (server stores files 15 min) | LOW | Architecture choice, not a UI feature; but must be communicated |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this product.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Batch processing (public) | Power users want efficiency | Defeats the simple single-image UX; increases abuse surface; PROJECT.md explicitly defers this to owner-only gated feature | Implement as hidden owner-only feature behind auth gate in v2 |
| User accounts (public) | "Save my device profile preferences" | Privacy tool users distrust account requirements; account creation friction kills conversions; auth infrastructure is significant scope | Session-based preference storage (localStorage) for device selection |
| Server-side processing option | "Faster for large files" | Completely contradicts the core privacy value proposition; any server involvement breaks the trust model | Keep 100% client-side; WebAssembly handles large files acceptably |
| Video metadata stripping | Logical extension of image tool | Extremely complex client-side (video codec parsing); PROJECT.md out of scope; dilutes the product focus | Clear scope statement: "Images only" |
| AI-generated image detection | Interesting but trendy | Not a privacy tool feature; creates false confidence; technically unreliable | Out of scope; separate tool territory |
| Social media platform presets ("optimised for Instagram") | Users want quick wins | Platforms change stripping behaviour constantly; false precision; encourages bad security assumptions | Educate: "Remove metadata before uploading anywhere" |
| Edit individual EXIF fields manually | Power user request | Creates complexity that undermines the simple UX; theXifer.net already serves this market well | Serve the "replace with device profile" use case instead — all-or-nothing |
| Metadata embedding for copyright protection | Photographers wanting to tag their work | Different audience, conflicting goals with privacy mission; can create legal/DMCA complexity | Out of scope; separate tool territory |

---

## Feature Dependencies

```
[JPEG/PNG/WebP processing]
    └──required by──> [Strip metadata]
    └──required by──> [Replace metadata]
    └──required by──> [Preview metadata]
    └──required by──> [Download processed image]

[HEIC input parsing] (exifr library)
    └──required by──> [HEIC support in all above]

[Device profile library]
    └──required by──> [Replace with device-realistic metadata]
    └──required by──> [Device-accurate output filename]
    └──required by──> [Metadata preview after replacement]

[GPS location picker]
    └──enhances──> [Replace with device-realistic metadata]
    └──requires──> [Map UI component (OpenStreetMap)]

[Preview metadata before stripping]
    └──enhances──> [Strip metadata] (trust signal)
    └──enhances──> [Metadata preview after replacement] (shared UI component)

[Replace with device-realistic metadata]
    └──conflicts with──> [Edit individual EXIF fields manually]
    (one is guided/preset, one is freeform — different UX paradigms, don't mix)
```

### Dependency Notes

- **HEIC parsing requires exifr (or equivalent):** Browser-native HEIC support is absent in most browsers; a parsing library is mandatory for this format. exifr is fastest at 0.2-0.3ms HEIC offset resolution vs 5-10ms for alternatives.
- **Device profile library must precede replacement feature:** The quality of device profiles directly determines whether the core differentiator works. Low-quality profiles kill the value prop.
- **GPS location picker enhances but does not block replacement:** A device profile replacement can embed a default plausible GPS (e.g., city-level) if the user skips the picker — the picker is an enhancement, not a hard requirement.
- **Preview UI is shared infrastructure:** The before/after metadata display is one component used in two contexts (strip + replace). Build it once.

---

## MVP Definition

### Launch With (v1)

Minimum viable product to validate the core differentiator (realistic metadata replacement).

- [ ] Drag-and-drop + click upload — JPEG, PNG, WebP, HEIC input
- [ ] Preview metadata found in uploaded image (table display)
- [ ] Strip all metadata mode — download clean image
- [ ] Replace with device profile mode — select from curated device list, inject realistic metadata
- [ ] GPS location picker — click map to embed plausible coordinates
- [ ] Device-accurate output filename generation
- [ ] Download processed image
- [ ] "Your image never leaves your device" trust indicator
- [ ] Single image processing (no batch)

### Add After Validation (v1.x)

Features to add once core flow is working and user feedback exists.

- [ ] Before/after metadata diff view — when usage shows users want to verify the replacement looks real
- [ ] Expanded device profile library — more variants, updated firmware strings, triggered by user requests for specific devices
- [ ] LocalStorage device preference — remembers last used device profile, triggered when returning users are identified

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Batch processing (owner-only, auth-gated) — as per PROJECT.md; defer until auth approach is decided
- [ ] User accounts — depends on batch feature decision
- [ ] Additional format support (AVIF, TIFF RAW) — defer until HEIC is stable

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Strip all metadata | HIGH | LOW | P1 |
| Preview metadata before action | HIGH | LOW | P1 |
| JPEG/PNG/WebP support | HIGH | LOW | P1 |
| Client-side processing + trust badge | HIGH | LOW | P1 |
| Device profile replacement | HIGH | HIGH | P1 |
| Device-accurate filename | HIGH | MEDIUM | P1 |
| HEIC input support | HIGH | HIGH | P1 |
| GPS location picker | MEDIUM | MEDIUM | P1 |
| Before/after metadata diff view | MEDIUM | MEDIUM | P2 |
| Expanded device profile library | MEDIUM | HIGH | P2 |
| LocalStorage device preference | LOW | LOW | P2 |
| Batch processing (owner-only) | MEDIUM | HIGH | P3 |
| User accounts | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | VerExif | ExifRemover | theXifer.net | MetaSpoof | MyLittleTools Faker | **Our Approach** |
|---------|---------|-------------|--------------|-----------|---------------------|------------------|
| Strip metadata | Yes | Yes | Yes | Yes | Yes | Yes |
| Preview metadata found | View only | Searchable table | Editable fields | No | Basic | Searchable table |
| Client-side only | Yes | Yes (WebAssembly) | No (server, 15min storage) | No (server-side) | Yes | Yes |
| JPEG | Yes | Yes | Yes | Yes | Yes | Yes |
| PNG | Unknown | Yes | Yes | Yes | Yes | Yes |
| WebP | Unknown | Yes | Yes | Yes | Unknown | Yes |
| HEIC | No | Yes | No | Yes | No | Yes |
| Replace with device profile | No | No | Partial (manual fields) | Basic (iPhone/Android only) | Future roadmap | Full profiles, multi-device |
| GPS location picker | View only | No | Yes (OpenStreetMap) | No | Basic lat/lng fields | Yes (map picker) |
| Device-accurate filename | No | No | No | No | No | Yes |
| Realistic firmware/lens data | No | No | No | No | No | Yes |
| Before/after diff | No | No | No | No | No | v1.x |
| Batch processing | No | Yes (20 files) | Yes (premium) | No | No | v2, owner-only |
| No account required | Yes | Yes | Yes (free tier) | Yes | Yes | Yes |

**Key observation:** No browser-based competitor offers device-realistic metadata replacement with accurate firmware strings, lens profiles, and device-correct filenames. MetaSpoof comes closest but is server-side and offers only iPhone/Android without granular device variant accuracy. This is the uncontested differentiation zone.

---

## Sources

- [VerExif — view and remove EXIF online](https://www.verexif.com/en/)
- [ExifRemover — strip metadata browser-side](https://exifremover.com/)
- [Metadata2Go — metadata viewer and editor](https://www.metadata2go.com/)
- [theXifer.net — EXIF editor FAQ](https://www.thexifer.net/faq)
- [MetaSpoof — device metadata spoofer](https://metaspoof.com/)
- [MyLittleTools Image Metadata Faker](https://www.mylittletools.in/tools/image-metadata-faker)
- [ISACA: EXIF Data as Cybersecurity Risk (2025)](https://www.isaca.org/resources/news-and-trends/industry-news/2025/what-to-know-about-exif-data-a-more-subtle-cybersecurity-risk)
- [EXIFData.org: GPS privacy guide](https://exifdata.org/blog/photo-gps-data-privacy-guide-to-exif-location-removal)
- [exifr — fastest JS EXIF/HEIC parsing library](https://github.com/MikeKovarik/exifr)
- [ExifReader — browser/Node EXIF parser with HEIC support](https://github.com/mattiasw/ExifReader)
- [exif-heic-js — HEIC EXIF extraction](https://github.com/exif-heic-js/exif-heic-js)
- [AlternativeTo: ExifTool alternatives](https://alternativeto.net/software/exiftool/)

---

*Feature research for: Image metadata stripping and replacement web app (Metadata Replacer)*
*Researched: 2026-03-04*
