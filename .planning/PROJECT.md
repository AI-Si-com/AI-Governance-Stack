# Metadata Replacer

## What This Is

A client-side web app that strips EXIF/IPTC/XMP metadata from uploaded images and optionally replaces it with highly realistic metadata from a chosen device — mobile phones (iPhone, Samsung, Google Pixel, Nokia, Windows Phone with model variants) or professional cameras (top 20). All processing happens in the browser; images never leave the user's device. Hosted publicly on Vercel.

## Core Value

Users can strip or replace image metadata with device-accurate spoofed data that passes inspection — all without their images ever leaving the browser.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Strip all EXIF/IPTC/XMP metadata from uploaded images
- [ ] Replace metadata with highly realistic device-specific data (make, model, lens, firmware, software version, shutter count patterns)
- [ ] Support device profiles: iPhone variants, Samsung variants, Google Pixel variants, Nokia variants, Windows Phone variants, top 20 professional cameras
- [ ] GPS location picker — user selects a location to embed plausible coordinates
- [ ] Output downloadable image with correct filename format for chosen device (e.g., IMG_1234.HEIC for iPhone, DSC_0001.JPG for Nikon)
- [ ] Support JPEG, PNG, HEIC/HEIF, and WebP input formats
- [ ] 100% client-side processing — no server uploads
- [ ] Branded with Montserrat font and ai-si.com colour palette
- [ ] Single image processing for public users
- [ ] Hosted on Vercel

### Out of Scope

- Batch processing — deferred to future version, gated to owner only
- User accounts / authentication — deferred until batch feature ships
- Server-side processing — privacy-first, client-only
- Video metadata — images only
- Mobile native app — web-first

## Context

- **Privacy + anonymity tool**: Both stripping metadata for privacy and spoofing for anonymity are equally core use cases
- **Realism matters**: Spoofed metadata should include accurate EXIF fields, lens info, firmware versions, GPS patterns — passes manual inspection
- **Batch architecture**: v1 is single image, but code should be structured so batch can be added later behind an auth gate (auth approach TBD)
- **Colour palette from ai-si.com**:
  - Deep Navy: #061832 (primary background/buttons)
  - Bright Blue: #0455F3 (hover/accent)
  - Vibrant Magenta: #F63BF1 (highlight/accent)
  - Light Blue: #60A5FA (secondary)
  - White: #FFFFFF (text on dark)
  - Light Gray: #f8fafc (page background)
  - Text: #1e293b, #334155
  - Border: #e2e8f0
- **Font**: Montserrat (Google Fonts)
- **HEIC handling**: Must work client-side — may need browser-based conversion library

## Constraints

- **Processing**: Client-side only — no image data touches a server
- **Hosting**: Vercel (free tier compatible)
- **Formats**: JPEG, PNG, HEIC/HEIF, WebP input; output matches device convention
- **Device profiles**: Must be comprehensive and accurate — real firmware strings, real lens data, real filename patterns

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side only processing | Maximum privacy — images never leave user's device | — Pending |
| Single image v1, batch later | Keep v1 simple, architect for extensibility | — Pending |
| Batch gated to owner only | Premium/admin feature, not public | — Pending |
| Vercel hosting | Free tier, easy deploy, good for static apps | — Pending |
| Highly realistic metadata | Core differentiator — passes inspection, not just basic field swap | — Pending |

---
*Last updated: 2026-03-04 after initialization*
