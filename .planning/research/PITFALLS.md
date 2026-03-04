# Pitfalls Research

**Domain:** Client-side image metadata manipulation / EXIF spoofing tool
**Researched:** 2026-03-04
**Confidence:** HIGH (critical pitfalls verified across multiple sources)

---

## Critical Pitfalls

### Pitfall 1: Incomplete Metadata Stripping — Thumbnail and MakerNote Residuals

**What goes wrong:**
A strip operation that clears standard EXIF IFD0/IFD1 fields leaves two dangerous residuals: (1) the embedded JPEG thumbnail inside the EXIF IFD1 block, which can show the original uncropped image before any crop, and (2) proprietary MakerNote data (a manufacturer-specific binary blob inside the EXIF Makernote tag) containing device serial number, shooting mode, internal sensor data, and lens calibration — none of which appears in standard tag listings. A tool that iterates only over named EXIF tags will silently leave both intact.

**Why it happens:**
JavaScript EXIF libraries default to parsing named/known tags only. `exifr` skips MakerNote by default for performance (it can be 10s of KBs). `piexifjs` writes a new EXIF structure but does not reconstruct the original binary to zero — only the tags it knows about are cleared. Developers test by reading back with the same library, which also skips MakerNote, so the residual is never seen.

**How to avoid:**
For stripping: do not reconstruct EXIF from scratch using a write library — zero out or remove the entire APP1 (EXIF) marker segment from the JPEG binary, then optionally reinsert only the tags you explicitly want. For PNG, strip all tEXt, iTXt, zTXt, and eXIf chunks wholesale. For WebP, strip the EXIF and XMP RIFF chunks at the byte level. Verify completeness using ExifTool in a test harness (even if production is browser-only, a test pipeline can run ExifTool against output files).

**Warning signs:**
- Output images read back with `exifr` show zero EXIF fields, but ExifTool reports remaining MakerNote bytes
- Thumbnail visible in EXIF viewers shows a cropped version that differs from the displayed image
- File size after stripping is anomalously large relative to expected (MakerNote from a DSLR can be 20–80 KB)

**Phase to address:**
Core metadata engine phase (first engineering phase). Must be verified with an automated test using ExifTool before the phase is considered complete.

---

### Pitfall 2: Spoofed MakerNote Absence Is a Forensic Tell

**What goes wrong:**
A spoofed image has correct Make, Model, LensModel, FocalLength, and GPS fields — but no MakerNote block. Every genuine photo from an iPhone, Samsung Galaxy, Google Pixel, or any DSLR contains a MakerNote. Forensic analysts and tools like FotoForensics and ExifTool explicitly flag missing MakerNote as suspicious for high-end camera profiles. The absence pattern is: "Has EXIF IFD0 fields consistent with Canon 5D Mark IV, but no Canon MakerNote." This is immediately detectable.

**Why it happens:**
MakerNote content is proprietary binary, manufacturer-specific, and reverse-engineered only partially. JavaScript EXIF write libraries (piexifjs, exifr) do not support writing MakerNote — they only write standardised IFD tags. Developers write the fields they can write and assume that's sufficient.

**How to avoid:**
For high-realism spoofing, source real MakerNote binary blobs for each device profile (extracted from actual sample photos) and inject them verbatim into the output EXIF stream. The injected blob should match the profile's device — a Canon MakerNote for a Canon profile, an Apple MakerNote for an iPhone profile. Ensure byte offsets in MakerNote pointers are correctly adjusted when inserting into a new EXIF structure (MakerNote pointer offsets break if the surrounding EXIF layout changes). For smartphone profiles, Apple's MakerNote contains fields like lens type identifier, image stabilisation flags, and burst UUID; a realistic Apple MakerNote blob is 400–1200 bytes.

**Warning signs:**
- ExifTool on spoofed output reports 0 MakerNote tags for a camera profile that normally produces 50+
- FotoForensics metadata analysis page shows empty MakerNote section for a professional camera profile
- File size of EXIF block is much smaller than reference samples (e.g. 2 KB vs expected 12 KB for iPhone)

**Phase to address:**
Device profile implementation phase. Each device profile should ship with a reference MakerNote blob. Verified by diffing output EXIF structure against reference sample photos.

---

### Pitfall 3: GPS Coordinates That Are Implausible for the Claimed Device Context

**What goes wrong:**
The GPS data is internally self-consistent (valid lat/lng rational format, correct reference chars N/S/E/W) but fails plausibility checks for related fields. Specifically:
- GPSAltitude is 0 or missing for a location that is 2000m above sea level
- GPSAltitudeRef is 1 (below sea level) for a landlocked inland city
- GPSImgDirection (compass bearing, 0–360 degrees) is absent, but genuine iPhone photos almost always include it
- GPSSpeed and GPSTrack are present with values that are impossible (e.g. speed 150 km/h for a stationary photo)
- The rational encoding of coordinates uses an unnaturally uniform denominator (e.g. exactly `5100000/100000`) rather than the variable denominators GPS chipsets produce

**Why it happens:**
Developers embed the user's chosen lat/lng and nothing else. Altitude is the most commonly omitted field. Bearing is rarely included because it requires compass data. Rational encoding is computed from a float using a simple multiply-by-fixed-denominator formula instead of the variable-denominator encoding GPS chipsets actually produce.

**How to avoid:**
- Altitude: integrate with an elevation API (e.g. Open-Meteo elevation, Google Elevation API) keyed to the user's chosen coordinates. This is a free call. Embed realistic altitude ± small jitter.
- GPSAltitudeRef: always `0` (above sea level) unless altitude is negative.
- GPSImgDirection: generate a random bearing 0.0–359.9, store as `GPSImgDirectionRef = M` (magnetic) and `GPSImgDirection = rational(bearing)`.
- GPSSpeed: omit entirely, or embed 0/1 for a stationary shot. Never embed a non-zero speed for a handheld phone profile.
- Rational encoding: use variable denominators matching chipset patterns — for degrees use `/1`, for minutes use `×10000/10000` style, not a uniform large denominator across all three components.

**Warning signs:**
- Altitude field is 0/1 for coordinates that resolve to Denver (1600m) or similar
- GPSImgDirection absent in iPhone profile output (it is present in 95%+ of genuine iPhone photos)
- Coordinate rational values all use identical denominators across degrees, minutes, seconds

**Phase to address:**
GPS picker feature phase. Elevation API call should be built in from the start, not added as polish.

---

### Pitfall 4: HEIC Input Loses Metadata During Conversion, Then Replacement Is Applied to Wrong Binary

**What goes wrong:**
The `heic2any` library converts HEIC to JPEG for processing, but its own documentation states it does not copy metadata from the source HEIC to the output JPEG. The pipeline therefore processes a metadata-free JPEG, writes spoofed EXIF onto it, and outputs a JPEG — but any original metadata context from the source HEIC is lost. Worse, if the developer reads EXIF from the HEIC first, then converts, then writes EXIF to the JPEG, the EXIF write target is the converted JPEG while the read source was the HEIC — a mismatch that can cause field-level inconsistencies.

**Why it happens:**
heic2any is the only practical pure-browser HEIC conversion library and its metadata behaviour is poorly documented. Developers discover the gap after implementing the pipeline end-to-end.

**How to avoid:**
Explicitly read metadata from the original HEIC ArrayBuffer before conversion (using `exifr` which supports HEIC), store it, convert the HEIC to JPEG (discarding any accidental metadata carry-over), then write fresh spoofed EXIF onto the converted JPEG. Never attempt to preserve or carry through original HEIC EXIF — treat HEIC as a pure pixel source. When outputting, if the user selected an iPhone profile, consider re-outputting as HEIC (using libheif-js WASM encoder) to maintain the expected `.HEIC` extension.

**Warning signs:**
- HEIC input is processed without an explicit `exifr.parse(heicArrayBuffer)` call before conversion
- Output filename is `.HEIC` but the binary is actually JPEG (the MIME type check fails)
- Metadata on HEIC-sourced output is inconsistent with metadata on JPEG-sourced output for the same profile

**Phase to address:**
Format support / HEIC phase. Pipeline architecture must be defined as: read → convert pixels → write metadata → encode output, with explicit format awareness at each stage.

---

### Pitfall 5: HEIC Output Not Supported by Most Browsers — Serving JPEG as HEIC

**What goes wrong:**
iPhone profile output is expected to have a `.HEIC` extension and HEIC binary. But encoding HEIC in the browser requires libheif-js with WASM, which is a 2.7 MB+ bundle, slow to encode (seconds on mid-range devices), and the HEIC encoder in libheif-js has limited quality/feature parity with Apple's native encoder. The common shortcut is to output JPEG bytes with a `.HEIC` extension — which passes a filename check but fails any file type sniff (magic bytes `ftyp` check) or content-type inspection.

**Why it happens:**
HEIC native browser encoding is non-trivial. Developers take the shortcut of renaming a JPEG as .HEIC because it satisfies the visual requirement (filename looks correct) but not the technical requirement (file is actually HEIC).

**How to avoid:**
For v1, be explicit about the trade-off: if true HEIC output is required, use libheif-js WASM encoder and accept the bundle size and encoding latency. If JPEG output with HEIC filename is a known compromise, document it visibly. A middle path: offer the user a choice ("Download as JPEG" or "Download as HEIC") and warn that HEIC encoding is slower. Do not silently rename JPEG to HEIC.

**Warning signs:**
- Output file has `.HEIC` extension but `file --mime-type` reports `image/jpeg`
- HEIC magic bytes (`00 00 00 xx 66 74 79 70`) are absent from start of output binary
- Encoding is instant (HEIC encoding via WASM takes measurably longer)

**Phase to address:**
Format support phase. Output format decision must be an explicit architectural choice, not a filename rename.

---

### Pitfall 6: Software / DateTime Fields Reveal the Tool's Presence

**What goes wrong:**
`Software` tag is left as a tool fingerprint: a default value like `"piexifjs 1.0"`, an empty string, or `"Adobe Photoshop"` when the device profile is an iPhone. The `Software` field for a genuine iPhone photo is the iOS version string (e.g. `"17.4.1"`). The `DateTime`, `DateTimeOriginal`, and `DateTimeDigitized` fields are either missing, set to current time (exposing the manipulation moment), or set to a date that is inconsistent with the GPS timestamp in `GPSDateStamp`/`GPSTimeStamp`.

**Why it happens:**
`Software` is an optional field developers often omit or leave as the library default. DateTime field multiplicity (three separate DateTime tags plus GPS date/time tags) is frequently handled inconsistently — set one, forget the others, or use `new Date()` which leaks the processing timestamp.

**How to avoid:**
- `Software`: must match the device profile precisely. iPhone → iOS version string. Android → camera app version. DSLR → firmware version string (e.g. `"Firmware Ver1.3.0"`).
- All three DateTime fields (`DateTime`, `DateTimeOriginal`, `DateTimeDigitized`) should be identical for an unedited camera photo. They should reflect a plausible capture time (user-supplied or randomly generated within a plausible window), not the current wall-clock time.
- `GPSDateStamp` and `GPSTimeStamp` must match `DateTimeOriginal` converted to UTC. Mismatch between these is a classic forensic indicator.
- Timezone offset fields (`OffsetTime`, `OffsetTimeOriginal`) should match the GPS location's timezone.

**Warning signs:**
- `Software` field contains "piexif", "exifr", "JavaScript", or any non-camera string
- `DateTime` and `DateTimeOriginal` differ (impossible for an unedited photo straight from the camera)
- `GPSTimeStamp` is in UTC but `DateTimeOriginal` reflects local time without a matching `OffsetTime` tag

**Phase to address:**
Device profile implementation phase. Each profile must specify Software string and firmware version. DateTime logic must be centralised to ensure all five time-related fields are set consistently.

---

### Pitfall 7: Unique Photo ID / ImageUniqueID Collisions Expose Batch or Repeat Use

**What goes wrong:**
`ImageUniqueID` is a 32-character hex string that, for genuine cameras, is generated per-shot and is globally unique. If all spoofed images from a tool share the same `ImageUniqueID` (either hardcoded or seeded from a constant), multiple images submitted by the same or different users will carry identical "unique" IDs — a forensically trivial signature of a spoofing tool. The same applies to `BodySerialNumber` (DSLR profiles): if the same serial number appears in all spoofed images, it is detectable.

**Why it happens:**
`ImageUniqueID` is an obscure field. Developers focus on visible EXIF fields. When it is included at all, it is often hardcoded from a sample photo.

**How to avoid:**
Generate `ImageUniqueID` as a random 32-character hex string per output image (crypto.getRandomValues for browser). For DSLR profiles, `BodySerialNumber` should be randomly generated within the valid serial number range for that model (Canon serial numbers follow a known length/format, Nikon similarly). Do not use a fixed serial number across all outputs.

**Warning signs:**
- Two output images have identical `ImageUniqueID` values
- `BodySerialNumber` is the same across output images from different sessions
- `ImageUniqueID` is a well-known sample value (e.g. copied from a tutorial or documentation)

**Phase to address:**
Device profile implementation phase. Per-output randomisation must be built into the profile rendering function.

---

### Pitfall 8: PNG and WebP Metadata Stripping Misses XMP and Non-Standard Chunks

**What goes wrong:**
JPEG metadata lives in APP markers that are well-understood. PNG metadata is distributed across multiple chunk types: `tEXt` (uncompressed key-value), `zTXt` (zlib-compressed), `iTXt` (international UTF-8, used for XMP), and `eXIf` (raw EXIF, added in PNG 1.6). A strip operation that only removes `tEXt` chunks leaves XMP in `iTXt` and EXIF in `eXIf`. WebP metadata lives in RIFF chunks (`EXIF` and `XMP ` — note the trailing space). A strip operation targeting only JPEG APP1 will leave WebP and PNG metadata completely intact.

**Why it happens:**
Most browser EXIF libraries are JPEG-first. When a PNG or WebP is passed in, they either silently no-op or only handle the `eXIf` chunk, missing `iTXt`/`tEXt` chunks. Developers test with JPEG samples, miss the format divergence.

**How to avoid:**
Implement format-specific strip/write paths:
- JPEG: Remove APP1 segment, optionally remove APP13 (IPTC), APP2 (ICC in some encoders).
- PNG: Remove `tEXt`, `zTXt`, `iTXt`, and `eXIf` chunks. Keep `gAMA`, `sRGB`, `cHRM`, `iCCP` (colour science, not privacy-sensitive).
- WebP: Parse RIFF chunks, remove `EXIF` and `XMP ` chunk types, keep `ICCP` if present.
For WebP EXIF write (to add spoofed metadata), use a binary RIFF builder since no mainstream JS library supports WebP EXIF write natively.

**Warning signs:**
- ExifTool reports XMP data on stripped PNG output
- WebP output from a metadata-carrying source retains its original EXIF after "stripping"
- A PNG uploaded with `iTXt` chunk containing GPS data shows GPS in output

**Phase to address:**
Core metadata engine phase. Format-specific code paths must be tested with format-specific sample files that contain all relevant chunk types.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `piexifjs` write for all EXIF and skip MakerNote entirely | Faster implementation, no binary injection complexity | All output images are trivially identifiable as spoofed (missing MakerNote) | Never — core product value requires MakerNote |
| Rename JPEG as `.HEIC` instead of encoding real HEIC | Eliminates 2.7 MB WASM bundle | File type sniff fails; advanced users will notice; filename/content mismatch is detectable | Only if explicitly disclosed to user as JPEG download |
| Use `new Date()` for all DateTime fields | Trivial implementation | Output timestamp exposes the exact moment of spoofing | Never |
| Hardcode GPS altitude as 0 | Eliminates elevation API dependency | Altitude 0 for Denver, Bogotá, or Mexico City is immediately implausible | Never for release — use elevation API or derive from location |
| Single hardcoded ImageUniqueID across all outputs | Zero effort | All output images share a forensic fingerprint | Never |
| Strip only JPEG APP1 regardless of input format | Simple code path | PNG and WebP inputs retain full metadata | Never for a privacy tool |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Elevation API (GPS altitude) | Calling on every GPS picker movement (drag) causing excessive requests | Debounce to fire only on picker release / confirm; cache results by coordinate tile |
| heic2any conversion | Assuming the conversion preserves metadata | Explicitly read EXIF from HEIC ArrayBuffer before conversion; treat conversion as pixel-only |
| piexifjs EXIF write | Passing float values for Rational fields | Encode all Rational fields as `[numerator, denominator]` integer pairs; floats silently corrupt the field |
| Canvas API for pixel extraction | Creating canvas at full image resolution for metadata-only operations | Never use Canvas for metadata operations — parse and write metadata at the byte level on the original ArrayBuffer; Canvas is only needed if pixel re-encoding is required |
| Vercel hosting + WASM (libheif) | WASM binary not served with correct MIME type or blocked by CSP | Set `Content-Type: application/wasm` in Vercel headers config; add `wasm-unsafe-eval` to CSP if required |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading heic2any synchronously on page load | 2.7 MB initial bundle blocks first meaningful paint | Lazy-load heic2any only when a HEIC file is detected in the input | Every page load, even for JPEG users |
| Using Canvas `getImageData` for metadata read | Copies entire pixel buffer from GPU to RAM; 50 MB HEIC → ~200 MB RAM spike | Parse metadata from raw ArrayBuffer using byte-level parsing; never decode pixels for metadata-only operations | Any image over ~8 MP on mobile |
| Not revoking Object URLs after download | Memory leak: each processed image URL held in memory until page close | Call `URL.revokeObjectURL()` immediately after the download link is clicked | After processing 3–5 large images in one session |
| heic2any Worker memory leak | Worker retains ~70 MB after each conversion | Terminate the Worker after conversion completes (`worker.terminate()`); reinitialise for next use | After first HEIC conversion |
| No file size limit on input | 100 MB HEIC/TIFF input triggers browser tab OOM kill on mobile | Enforce a client-side input limit (suggest: 50 MB); show user-friendly error for oversized files | Any 48 MP+ raw HEIC on mobile Safari |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting images with no pixel dimension check | Pixel flood / decompression bomb: a 1 KB PNG with declared dimensions of 64250×64250 expands to ~12 GB in memory, killing the tab or the device | Before rendering/processing, check decoded pixel dimensions and reject if width × height > 200 megapixels |
| Embedding user-supplied free-text into EXIF fields without sanitisation | XSS via EXIF fields if metadata is later read and rendered as HTML elsewhere | Sanitise all user-supplied strings (location name, description fields) before embedding in EXIF; treat all string EXIF fields as untrusted input |
| Leaking file names in browser history or URL | User's original filename (which may contain real identity info) visible in browser history | Process entirely in memory; never append filename to URL; use a neutral download filename based on the chosen device profile |
| No client-side Content-Type validation | User renames a non-image file to `.jpg`; processing code crashes or exposes parser edge cases | Validate magic bytes (not file extension): JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `52 49 46 46`, HEIC `66 74 79 70` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| HEIC conversion takes 5–15 seconds with no progress indicator | User assumes the app is broken and refreshes, losing work | Show a spinner/progress message during HEIC WASM processing; HEIC conversion is the slowest operation |
| No preview of spoofed metadata before download | User downloads image, opens in ExifTool, finds errors, has to re-upload | Show a summary of embedded metadata fields before the download button appears |
| GPS picker defaults to 0,0 (null island) | User forgets to set location; output has obviously wrong coordinates (Atlantic Ocean) | Default GPS picker to a neutral, plausible location; or require explicit selection before enabling download |
| Download filename is the original uploaded filename | Original filename may contain real device info or sequential numbers from the user's actual device | Override download filename with device-profile-appropriate name (e.g. `IMG_4821.HEIC` for iPhone) using a random number in the device's typical range |
| No indication that processing is 100% client-side | Privacy-conscious users may distrust the tool without this reassurance | Display a clear, prominent "Never leaves your device" message adjacent to the upload zone |

---

## "Looks Done But Isn't" Checklist

- [ ] **Metadata strip:** Verified complete using ExifTool on output — not just the JavaScript library that did the stripping. Check for MakerNote bytes, thumbnail, XMP in all formats.
- [ ] **HEIC output:** Verify magic bytes of output file begin with HEIC `ftyp` box, not JPEG `FF D8 FF`. Do not rely on extension.
- [ ] **GPS fields:** All five GPS fields set — Latitude, Longitude, Altitude, AltitudeRef, ImgDirection. GPSTimeStamp matches DateTimeOriginal in UTC.
- [ ] **DateTime consistency:** `DateTime`, `DateTimeOriginal`, `DateTimeDigitized` are identical. `GPSDateStamp`/`GPSTimeStamp` match `DateTimeOriginal` in UTC.
- [ ] **Software field:** Contains the device-specific string (iOS version, firmware version) — not a library name, not empty, not "Adobe Photoshop".
- [ ] **MakerNote:** Present in output for all device profiles. Absent MakerNote for an iPhone profile is a critical failure.
- [ ] **ImageUniqueID:** Randomly generated per output — not hardcoded. Verify two sequential outputs have different values.
- [ ] **PNG and WebP stripping:** Tested with actual PNG files containing `iTXt` XMP chunks and actual WebP files with embedded EXIF. Not just JPEG.
- [ ] **File size guard:** Upload of a 100 MB file is rejected with a helpful error, not a silent tab crash.
- [ ] **Filename:** Download filename matches device profile convention (e.g. `DSC_0472.JPG` for Sony, `IMG_4821.HEIC` for iPhone) — not the user's original filename.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| MakerNote absent from all profiles | HIGH | Source real MakerNote binary blobs from sample photos for each device; implement binary injection in EXIF writer; retest all profiles |
| Incomplete PNG/WebP stripping discovered post-launch | MEDIUM | Add format-specific chunk parsers; backfill test suite with format-specific samples; redeploy |
| GPS altitude missing/wrong | LOW | Integrate elevation API; add altitude jitter logic; update GPS write function; test against known coordinates |
| heic2any memory leak causing crashes in production | MEDIUM | Switch to `libheif-js` WASM with explicit Worker termination; test on mobile Safari |
| DateTime fields exposing processing time | LOW | Centralise DateTime generation function; fix to use user-supplied time or plausible random offset; test all profiles |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Incomplete metadata stripping (MakerNote, thumbnail) | Core metadata engine | ExifTool output on stripped image shows zero bytes of EXIF/XMP across all four formats |
| Missing MakerNote in spoofed output | Device profile implementation | ExifTool on spoofed output shows MakerNote block present and non-empty for all profiles |
| GPS implausibility (altitude, bearing, rational encoding) | GPS picker feature | Cross-check spoofed GPS fields against reference samples from the same device profile |
| HEIC binary vs JPEG-renamed-as-HEIC | Format support | Magic byte check on all HEIC output files; MIME sniff passes |
| HEIC metadata loss during conversion pipeline | Format support | Round-trip test: HEIC input with known EXIF → pipeline → verify spoofed EXIF present on output |
| Software / DateTime forensic tells | Device profile implementation | Automated field-by-field comparison against reference sample photos for each profile |
| ImageUniqueID / serial number collisions | Device profile implementation | Generate 100 outputs from same profile; verify all ImageUniqueID values are unique |
| PNG/WebP stripping misses chunks | Core metadata engine | Format-specific test matrix: PNG with iTXt, PNG with eXIf, WebP with EXIF chunk |
| Pixel flood / decompression bomb | Core upload / file handling | Attempt upload of known bomb images; verify rejection before any decode attempt |
| Memory leaks (HEIC Worker, Object URLs) | Performance / QA | Process 10 sequential HEIC images; monitor memory in DevTools; verify no accumulation |

---

## Sources

- [Forensic Value of Exif Data — SCIEPublish](https://www.sciepublish.com/article/pii/567) — EXIF forensic analysis methodology
- [Protecting Visual Assets: Digital Image Counter-Forensics — Black Hat 2017 (Mazurov)](https://blackhat.com/docs/us-17/wednesday/us-17-Mazurov-Brown-Protecting-Visual-Assets-Digital-Image-Counter-Forensics.pdf) — Counter-forensics techniques, MakerNote analysis
- [FotoForensics Metadata Tutorial](https://fotoforensics.com/tutorial.php?tt=meta) — What forensic analysts look for in metadata
- [Detect Fake EXIF Data — EXIFData.org](https://exifdata.org/blog/detect-fake-exif-data-identifying-altered-photo-metadata) — Software field tells, quantisation matrix detection
- [Handling HEIC on the Web — Upside Lab](https://upsidelab.io/blog/handling-heic-on-the-web) — heic2any limitations, metadata loss during conversion
- [heic2any Worker memory leak — GitHub Issue #30](https://github.com/alexcorvi/heic2any/issues/30) — 70 MB Worker retention bug
- [HEIF/HEIC Browser Support — Can I Use](https://caniuse.com/heif) — Browser native support status
- [Exiv2 MakerNote Reference](https://exiv2.org/makernote.html) — MakerNote proprietary formats by manufacturer
- [ExifTool GPS Tags Reference](https://exiftool.org/TagNames/GPS.html) — GPS field specifications, rational encoding
- [ICC Profiles, EXIF, and Privacy — ShortPixel Blog](https://shortpixel.com/blog/icc-profiles-exif-and-privacy-what-metadata-to-keep-vs-strip/) — What survives aggressive stripping
- [piexifjs GitHub](https://github.com/hMatoba/piexifjs) — Write library limitations
- [exifr GitHub — MakerNote handling](https://github.com/MikeKovarik/exifr) — MakerNote skipped by default
- [Pixel Flood Attack — HackerOne Report #390](https://hackerone.com/reports/390) — Decompression bomb via image dimensions
- [Safely Process Images Without Memory Overflows — Trailhead Technology](https://trailheadtechnology.com/safely-process-images-in-the-browser-without-memory-overflows/) — Browser memory management for image processing
- [Design Rule for Camera File System — Wikipedia](https://en.wikipedia.org/wiki/Design_rule_for_Camera_File_system) — DCF filename convention standards
- [ISACA: What to Know About EXIF Data](https://www.isaca.org/resources/news-and-trends/industry-news/2025/what-to-know-about-exif-data-a-more-subtle-cybersecurity-risk) — Current EXIF privacy risk landscape

---
*Pitfalls research for: Client-side image metadata manipulation / EXIF spoofing (Metadata Replacer)*
*Researched: 2026-03-04*
