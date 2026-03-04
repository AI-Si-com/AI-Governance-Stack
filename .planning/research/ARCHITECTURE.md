# Architecture Research

**Domain:** Client-side image metadata manipulation web app
**Researched:** 2026-03-04
**Confidence:** HIGH (core pipeline), MEDIUM (HEIC handling), HIGH (location picker)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer (React)                         │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  FileDropzone │ DeviceSelector│ LocationPicker│  PreviewPanel     │
│  (file input) │ (profile pick)│ (map widget)  │  (output/download)│
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Orchestrator / App State                        │
│  (React state or Zustand — holds: file, profile, gps, output)   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Processing Pipeline (Web Worker)              │
├──────────────┬──────────────────────┬────────────────────────────┤
│ Format Router│  Metadata Reader     │  Metadata Writer           │
│  (detect fmt)│  (exifr — read-only) │  (piexifjs for JPEG;       │
│              │                      │   custom for PNG/WebP)      │
├──────────────┴──────────────────────┴────────────────────────────┤
│ HEIC Decoder (heic2any/libheif-js — convert HEIC → JPEG first)  │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Data Layer (in-memory only)                   │
├───────────────────────────┬──────────────────────────────────────┤
│  Device Profile Store     │  GPS State                           │
│  (static JSON, bundled)   │  (lat/lng from location picker)      │
└───────────────────────────┴──────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Download Generator                            │
│  Blob → URL.createObjectURL() → <a download="[device-filename]"> │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| FileDropzone | Accept file input (drag+drop or click), validate format, pass raw File to orchestrator | React component + HTML5 File API |
| DeviceSelector | Browse/search device profiles (phones + cameras), emit selected profile object | React component, searches bundled JSON |
| LocationPicker | Display interactive map, let user click a point, emit lat/lng | react-leaflet + OpenStreetMap (no API key needed) |
| PreviewPanel | Show original vs output thumbnail, display metadata diff, trigger download | React component |
| Orchestrator / App State | Coordinate data between components, trigger pipeline, hold all state | Zustand store or React Context + useReducer |
| Format Router | Detect MIME type / magic bytes, route to correct decode/encode path | Utility module, pure function |
| HEIC Decoder | Convert HEIC/HEIF to JPEG ArrayBuffer before rest of pipeline runs | heic2any (browser WASM wrapper) |
| Metadata Reader | Parse existing EXIF/IPTC/XMP tags from the input file | exifr (read-only, supports JPEG/PNG/HEIC/WebP) |
| Metadata Writer | Serialise new/spoofed metadata back into binary image | piexifjs (JPEG); custom chunk writer (PNG); custom EXIF block writer (WebP) |
| Device Profile Store | Hold static JSON profiles for all device makes/models | Bundled JSON files, loaded at startup |
| Download Generator | Produce a downloadable Blob with correct filename for the chosen device | URL.createObjectURL + anchor click |
| Processing Pipeline | Run decode → read → profile merge → write in a background thread | Web Worker (keeps UI thread unblocked) |

## Recommended Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Single-page root (SSR disabled via 'use client')
│   └── layout.tsx              # Font + colour palette providers
│
├── components/                 # UI components
│   ├── FileDropzone.tsx        # Drag-and-drop file input
│   ├── DeviceSelector.tsx      # Searchable device profile picker
│   ├── LocationPicker.tsx      # Leaflet map for GPS selection
│   ├── PreviewPanel.tsx        # Before/after preview + download button
│   └── MetadataDiff.tsx        # Shows which tags changed
│
├── workers/                    # Web Worker scripts
│   └── metadata.worker.ts      # Pipeline: decode → read → write → return Blob
│
├── lib/
│   ├── pipeline/               # Core processing logic
│   │   ├── formatRouter.ts     # Detect format from magic bytes
│   │   ├── heicDecoder.ts      # HEIC → JPEG via heic2any
│   │   ├── metadataReader.ts   # exifr wrapper (read existing tags)
│   │   ├── metadataWriter.ts   # Format-aware write dispatcher
│   │   ├── jpegWriter.ts       # piexifjs wrapper for JPEG EXIF
│   │   ├── pngWriter.ts        # PNG tEXt/eXIf chunk writer
│   │   └── webpWriter.ts       # WebP EXIF block writer
│   │
│   ├── profiles/               # Device metadata profiles
│   │   ├── phones/
│   │   │   ├── apple.json      # iPhone models + firmware strings
│   │   │   ├── samsung.json    # Galaxy variants
│   │   │   ├── google.json     # Pixel variants
│   │   │   ├── nokia.json      # Nokia variants
│   │   │   └── windowsphone.json
│   │   ├── cameras/
│   │   │   └── professional.json  # Top 20 DSLR/mirrorless profiles
│   │   └── profileResolver.ts  # Load + search profiles, emit ExifPayload
│   │
│   ├── download/
│   │   └── downloadGenerator.ts # Blob → filename → anchor click
│   │
│   └── utils/
│       ├── magicBytes.ts       # Format detection from ArrayBuffer header
│       └── gpsFormatter.ts     # Decimal degrees → EXIF DMS rational format
│
├── store/
│   └── appStore.ts             # Zustand store (file, profile, gps, output)
│
├── types/
│   ├── DeviceProfile.ts        # Profile shape: make, model, firmware, lens, filename pattern
│   ├── ExifPayload.ts          # Typed EXIF field map going into writer
│   └── PipelineResult.ts       # What the worker returns to main thread
│
└── styles/
    └── globals.css             # Montserrat font, ai-si.com colour tokens
```

### Structure Rationale

- **workers/**: Isolated from React — the pipeline runs off the main thread. Web Worker boundary is clean; only serialisable messages cross it (ArrayBuffer transferred, not copied).
- **lib/pipeline/**: Each file has one job. Format-specific writers are separate files so PNG/WebP logic doesn't contaminate JPEG logic.
- **lib/profiles/**: Static JSON, never fetched at runtime. Bundled by Next.js at build time. Fast lookup, no network dependency.
- **store/**: Single Zustand store is sufficient for this app's modest state surface. No need for Redux or Context splitting.
- **types/**: Strict TypeScript interfaces prevent leaking raw exifr output shapes into writer code.

## Architectural Patterns

### Pattern 1: Read-Transform-Write Pipeline

**What:** Separate reading existing metadata (exifr) from writing new metadata (piexifjs / custom writers). Never pass the exifr output object directly into the writer — transform it through a typed `ExifPayload` intermediate.

**When to use:** Always. Keeps library coupling isolated to two thin adapter modules.

**Trade-offs:** Slight overhead of the intermediate type; massive gain in testability and library replaceability.

**Example:**
```typescript
// metadataWriter.ts
export async function writeMetadata(
  buffer: ArrayBuffer,
  format: ImageFormat,
  payload: ExifPayload
): Promise<ArrayBuffer> {
  switch (format) {
    case 'jpeg': return jpegWriter.write(buffer, payload);
    case 'png':  return pngWriter.write(buffer, payload);
    case 'webp': return webpWriter.write(buffer, payload);
    // heic is pre-converted to jpeg before this point
    default: throw new Error(`Unsupported format: ${format}`);
  }
}
```

### Pattern 2: Web Worker Isolation

**What:** The entire processing pipeline (decode → read → write) runs inside a dedicated Web Worker. The main thread only sends the raw `ArrayBuffer` and `ExifPayload` and receives the processed `ArrayBuffer` back.

**When to use:** Any CPU-bound operation that could lock the UI. HEIC decoding (2.7 MB WASM payload) and metadata binary manipulation both qualify.

**Trade-offs:** Adds complexity of message-passing protocol; transfers ArrayBuffer ownership (zero-copy) so no performance penalty.

**Example:**
```typescript
// metadata.worker.ts
self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { buffer, format, payload } = e.data;
  const decoded  = format === 'heic' ? await heicDecoder.decode(buffer) : buffer;
  const written  = await metadataWriter.writeMetadata(decoded, format === 'heic' ? 'jpeg' : format, payload);
  self.postMessage({ result: written }, [written]); // transfer, not copy
};
```

### Pattern 3: Static Device Profile Registry

**What:** Device profiles are plain JSON files bundled at build time, not fetched from an API. A `profileResolver.ts` module provides search and selection. Profiles contain all EXIF fields needed per device: Make, Model, Software, LensMake, LensModel, FNumber, ExposureProgram, and filename pattern.

**When to use:** Data that changes rarely (device firmware versions) and must work offline.

**Trade-offs:** Bundle size grows with more profiles (mitigated by tree-shaking phone/camera separately); profiles need manual updates when new devices are added.

**Example:**
```typescript
// types/DeviceProfile.ts
export interface DeviceProfile {
  id: string;
  category: 'phone' | 'camera';
  make: string;
  model: string;
  software: string;
  lensModel?: string;
  fNumber?: [number, number]; // rational
  filenamePattern: string;    // e.g. "IMG_{n}.HEIC", "DSC_{n}.JPG"
  exifDefaults: Partial<ExifPayload>;
}
```

### Pattern 4: HEIC Decode-then-Discard

**What:** HEIC/HEIF has no native browser support and no browser-side EXIF write library. The pipeline decodes HEIC to JPEG via heic2any (WASM), then treats the result as JPEG for all subsequent processing. The output file is JPEG with a `.heic`-convention filename only if the user specifically chose an iPhone profile. The raw HEIC data is discarded after decode.

**When to use:** Any HEIC input file.

**Trade-offs:** Output is technically JPEG-encoded regardless of input format. For a privacy/spoofing tool this is acceptable; for lossless round-tripping it is not. Flag this decision in UI copy.

## Data Flow

### Primary Flow: Strip + Replace Metadata

```
User drops file
    │
    ▼
FileDropzone → reads File → passes ArrayBuffer to Orchestrator
    │
    ▼
Orchestrator → sends { buffer, format } to Web Worker
    │
    ▼
Worker: formatRouter detects format from magic bytes
    │
    ├─ HEIC? → heicDecoder → ArrayBuffer (JPEG)
    └─ JPEG/PNG/WebP → pass through
    │
    ▼
Worker: metadataReader reads existing tags (informational only, for diff display)
    │
    ▼
Orchestrator → User selects device profile + GPS location (UI, main thread)
    │
    ▼
Orchestrator → profileResolver merges profile + GPS → ExifPayload
    │
    ▼
Worker: metadataWriter strips all existing metadata, writes ExifPayload
    │
    ▼
Worker → returns processed ArrayBuffer to main thread
    │
    ▼
downloadGenerator → Blob → URL.createObjectURL → <a download="IMG_1234.JPG">
```

### State Flow

```
AppStore (Zustand)
  ├── file: File | null
  ├── format: ImageFormat | null
  ├── existingMetadata: Partial<ExifPayload>    ← from reader, for diff display
  ├── selectedProfile: DeviceProfile | null
  ├── gpsLocation: { lat: number; lng: number } | null
  ├── outputBuffer: ArrayBuffer | null
  └── status: 'idle' | 'processing' | 'done' | 'error'

UI subscribes to status → show spinner, result, or error
LocationPicker writes → store.gpsLocation
DeviceSelector writes → store.selectedProfile
Download button reads → store.outputBuffer + store.selectedProfile.filenamePattern
```

### Key Data Flows

1. **File ingestion:** File API → ArrayBuffer (FileReader or `.arrayBuffer()`) → format detection from first 4–12 bytes (magic bytes). Never send to server.
2. **Profile resolution:** User picks a device ID → profileResolver loads the matching JSON profile → merges with GPS lat/lng → converts GPS to EXIF DMS rational format → produces `ExifPayload`.
3. **EXIF GPS encoding:** Decimal degrees (from map click) → degrees/minutes/seconds as EXIF rational arrays. This conversion must happen before the writer. Example: `51.5074°N` → `[[51,1],[30,1],[26,4,10]]`.
4. **Filename generation:** Profile `filenamePattern` (`IMG_{n}.HEIC`) + a random 4-digit number → final download filename. Presented to user before download.
5. **Download:** Processed ArrayBuffer → `new Blob([buffer], { type: 'image/jpeg' })` → `URL.createObjectURL` → anchor click → `URL.revokeObjectURL` (immediate cleanup).

## Scaling Considerations

This app is entirely client-side — "scaling" is about user-side performance, not server load.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user session | Current architecture is correct — no changes needed |
| Large files (>20 MB HEIC) | HEIC decode in Web Worker already handles this; add progress events from worker |
| More device profiles (100+) | Split JSON by category, lazy-load camera vs phone profiles on demand |
| Batch mode (future) | Add a queue in the worker — process files sequentially or with a concurrency limit of 2 |

### Scaling Priorities

1. **First bottleneck:** HEIC decoding — 2.7 MB WASM load + decode time. Mitigate with Worker isolation (already planned) and lazy WASM load only when HEIC detected.
2. **Second bottleneck:** Profile search UX with 100+ devices — mitigate with a simple fuzzy-search index (Fuse.js or built-in filter) over the profile JSON at startup.

## Anti-Patterns

### Anti-Pattern 1: Passing Blob URLs Across the Worker Boundary

**What people do:** Create a `Blob URL` in the worker and `postMessage` it to the main thread.
**Why it's wrong:** Blob URLs are origin-scoped and tied to the realm where they were created. A URL created in a Worker context may not resolve correctly in the main thread in all browsers.
**Do this instead:** Transfer the raw `ArrayBuffer` from the worker to the main thread (using `postMessage(result, [result])` with the transfer list), then create the Blob URL on the main thread.

### Anti-Pattern 2: Using exifr for Writing

**What people do:** Read with exifr, try to mutate the output and write it back.
**Why it's wrong:** exifr is read-only. Its output is a parsed JavaScript object, not a binary-writable structure. Attempting to pass it to any writer will require full re-serialisation.
**Do this instead:** Use exifr to read for display/diff purposes only. Use piexifjs (JPEG) or custom chunk writers (PNG/WebP) for writing.

### Anti-Pattern 3: Loading heic2any Eagerly

**What people do:** Import heic2any at the top of the worker, causing its 2.7 MB WASM to load for every user even when no HEIC file is uploaded.
**Why it's wrong:** Wastes 2.7 MB of bandwidth and parse time for JPEG/PNG/WebP users (likely the majority).
**Do this instead:** Dynamic import inside the Worker: `const heic2any = await import('heic2any')` — triggered only when format detection returns `'heic'`.

### Anti-Pattern 4: Storing Device Profiles as a Single Large JSON File

**What people do:** Put all phones and cameras into one `profiles.json` and import it at build time.
**Why it's wrong:** A comprehensive set covering all variants (iPhone 7 through 16, Samsung S series through A series, Pixel 1–9, Nokia, Windows Phone, 20 cameras) will easily reach 200–400 KB of JSON. This is unnecessary initial load cost.
**Do this instead:** Split into `phones.json` and `cameras.json` (or per-brand files). Lazy-load the non-default category on demand. The phone profiles load first since that is the likely primary use case.

### Anti-Pattern 5: Writing Metadata Directly to the Original File Object

**What people do:** Attempt to modify the `File` or `Blob` from the user's input in-place.
**Why it's wrong:** `File` objects are immutable in the browser. Any operation must produce a new `ArrayBuffer` or `Blob`.
**Do this instead:** Always treat the pipeline as a transform: `ArrayBuffer in → ArrayBuffer out`. Never mutate the input.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenStreetMap (Leaflet tiles) | CDN tile fetch from `tile.openstreetmap.org` | No API key required; usage policy requires attribution in UI |
| Google Fonts (Montserrat) | CSS `@import` in `globals.css` | Self-host via `next/font` for privacy + performance |
| Vercel (hosting) | Static export or Next.js SSR | For 100% client-side processing, `output: 'export'` in `next.config.ts` is cleanest |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI components ↔ Zustand store | Direct store reads/writes (subscribe pattern) | No prop drilling needed |
| Main thread ↔ Web Worker | `postMessage` with ArrayBuffer transfer | Use a typed message protocol: `{ type, payload }` |
| profileResolver ↔ Device JSON | Static import or dynamic import | Lazy-load by category |
| metadataWriter ↔ format-specific writers | Function call (same module boundary) | No message passing — all in worker |
| downloadGenerator ↔ UI | Returns Blob URL string; UI triggers anchor click | Revoke URL after click to free memory |

## Build Order (Phase Dependencies)

These are the logical sequencing constraints — each item depends on those above it being stable:

1. **Project scaffold + toolchain** — Next.js, TypeScript, Tailwind, Zustand. Unblocks everything.
2. **Device profile JSON schema + data** — Needed before writer, selector, or filename generation can be built. Profile shape drives TypeScript types.
3. **Format detection utility** — Pure function, zero dependencies. Build and test in isolation.
4. **Metadata reader (exifr integration)** — Read-only, no binary writing complexity. Verifies file ingestion works.
5. **JPEG metadata writer (piexifjs)** — First write capability. JPEG is the most common format and best-supported.
6. **Web Worker harness** — Wrap steps 3-5 in a Worker. Validate message-passing protocol.
7. **UI: FileDropzone + DeviceSelector + basic preview** — First end-to-end flow (JPEG only).
8. **Download generator** — Depends on writer output. Completes the v1 JPEG flow.
9. **Location picker (react-leaflet)** — Depends on GPS formatter utility. Can be built in parallel with step 8.
10. **GPS formatter + profile GPS merge** — Connects location picker to writer payload.
11. **PNG writer (custom chunk)** — Second format. Build after JPEG writer is stable (shares ExifPayload type).
12. **WebP writer (custom EXIF block)** — Third format. Similar complexity to PNG writer.
13. **HEIC decoder (heic2any, lazy-loaded in worker)** — Last format. Highest complexity, depends on worker harness being solid.
14. **Filename generation + output conventions** — Depends on profiles and download generator.
15. **UI polish** — Montserrat, colour palette, metadata diff display.

## Sources

- [exifr — GitHub](https://github.com/MikeKovarik/exifr) — Confirmed: read-only, supports JPEG/TIFF/HEIC/PNG/AVIF/WebP, modular bundles
- [piexifjs — GitHub](https://github.com/hMatoba/piexifjs) — Confirmed: JPEG-only read/write, uses DataURL or binary string
- [metadata.js — GitHub](https://github.com/thomasdideriksen/metadata) — Confirmed: JPEG/TIFF read/write via ArrayBuffer, browser-compatible, no IPTC/XMP
- [heic2any — GitHub](https://github.com/alexcorvi/heic2any) — Confirmed: browser HEIC→JPEG/PNG/GIF, 2.7 MB WASM, async/Web Worker support
- [Handling HEIC on the web — Upside](https://upsidelab.io/blog/handling-heic-on-the-web) — HEIC browser support status, performance warnings
- [react-leaflet](https://react-leaflet.js.org/) — Official docs, OpenStreetMap integration, no API key
- [Auth0: Read, Edit, Erase Location with Piexifjs](https://auth0.com/blog/read-edit-exif-metadata-in-photos-with-javascript/) — Confirmed piexifjs write pipeline
- [Getaround Tech: JPEG and EXIF Manipulation](https://getaround.tech/exif-data-manipulation-javascript/) — DataView binary manipulation patterns
- [Web Workers + React + TypeScript — LogRocket](https://blog.logrocket.com/web-workers-react-typescript/) — Worker message protocol patterns
- [MDN: Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) — Blob URL lifecycle and revokeObjectURL

---
*Architecture research for: Client-side image metadata manipulation web app (Metadata Replacer)*
*Researched: 2026-03-04*
