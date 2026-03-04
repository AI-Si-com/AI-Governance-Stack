# Phase 1: Scaffold - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Project foundation: Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui project with Web Worker harness, Zustand store skeleton, and Vercel deployment. This is the base that all subsequent phases build on.

</domain>

<decisions>
## Implementation Decisions

### Page layout
- Single-page app — upload, options, preview, download all in one scrollable flow
- Landing page: hero + upload zone only — trust badge, headline, drag-and-drop area, nothing else above the fold
- After upload: upload zone transforms into the workspace — shows preview, metadata, and actions in place of the dropzone
- Minimal header: logo/name on the left, maybe a GitHub link or about link on the right — subtle, doesn't compete with the tool

### Project naming
- Public-facing name: "Metadata Replacer" — descriptive, clear, SEO-friendly
- Meta tags: privacy-first framing — "Strip & replace image metadata privately in your browser — no uploads, no servers"
- URL: Vercel default URL for now (metadata-replacer.vercel.app or similar) — custom domain added later

### Deployment setup
- Auto-deploy on push to main — standard Vercel workflow
- Environment variables: set up .env.local template and Vercel env config even if empty — ready for later phases

### Worker architecture
- Full Worker harness from day one: typed message protocol, ArrayBuffer transfer, lazy WASM import support, terminate-and-respawn pattern
- Zustand store: slots + basic setters only (setFile, setStatus, reset) — actions added by later phases as needed

### Claude's Discretion
- ESLint/Prettier configuration details
- Exact shadcn/ui components to install initially
- Vitest setup specifics
- Folder structure within src/

</decisions>

<specifics>
## Specific Ideas

- Privacy-first meta description: "Strip & replace image metadata privately in your browser — no uploads, no servers"
- Landing page should feel clean and focused — trust comes from simplicity, not marketing
- Upload zone transforms into workspace (not reveal-below or side-by-side)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the patterns

### Integration Points
- This phase creates all integration points: app shell, Worker bridge, Zustand store, shadcn/ui theme

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-scaffold*
*Context gathered: 2026-03-04*
