# AGENTS.md - Agent & Contributor Directives

This document is the operating manual for AI agents and human contributors working on this repository.

---

## 1. Core Mission & Anti-Slop Principles

This project is a browser-based, client-side PDF editor that edits **real PDF content streams** - never a flattening canvas or whiteout overlay hack.

### Anti-Slop Mandates
1. **Never generate AI-slop UI**: Avoid generic template tropes, meaningless purple/blue gradient backgrounds, floating sparkles/emojis (`✨`, `🚀`), inflated metric cards, and noisy borders.
2. **Typography & Layout**: Prioritize crisp, readable, high-contrast layouts inspired by modern brutalist and minimalist web standards (Swiss typography, clean 1px borders, safety amber focus accents). Always maintain instant Light Mode and Dark Mode support.
3. **Copy & Content**: Write honest, concise, direct human copy. Never insert fake testimonials, placeholder buzzwords, or bloated marketing filler.
4. **Code Quality**: Write minimal, performant, clean code. Do not add unused libraries or complex wrappers when simple standard solutions suffice.
5. **No Em Dashes**: Do not use em dashes in code, comments, or documentation.

---

## 2. Monorepo Architecture

```
pdf-editor/
├── packages/
│   ├── core/       # Pure TypeScript document model, selection, and history (undo/redo). No DOM dependencies.
│   ├── engine/     # PDF stream tokenizer, interpreter, MuPDF WASM writer, and edit splicer.
│   ├── fonts/      # Font service, subsetting, and fallback metrics.
│   ├── render/     # PDF display renderer wrappers.
│   └── ui/         # Reusable React components.
├── apps/
│   └── web/        # Vite + React 18 client application.
├── fixtures/       # Test PDF fixtures and golden test data.
├── docs/           # Architecture decision records and engineering notes.
└── out/            # Artifact outputs (POC renders, diff images, exported test PDFs).
```

### Dependency Rules
- `core` depends on nothing except types.
- `engine` and `fonts` depend on `core` types only.
- `apps/web` wires the engine and core to the UI.

---

## 3. PDF Content Stream Editing Rules

1. **Native Stream Editing**:
   - Visible text is rendered by operators (`Tj`, `TJ`, `'`, `"`).
   - Edits modify the operator operands in the decoded stream and write them back into the page dictionary's `/Contents` stream.
2. **Reverse Byte Splicing**:
   - Multiple text edits on a page must be applied in **descending order of byte offset** (from end of stream to beginning). This prevents string length changes from invalidating earlier offsets.
3. **Buffer Isolation & Cloning**:
   - `pdfjsLib.getDocument({ data })` transfers and detaches its input buffer to a background Web Worker. Always clone byte arrays (`bytes.slice()`) before passing them to PDF.js.
   - When extracting bytes from MuPDF WASM (`doc.saveToBuffer().asUint8Array()`), always slice the bytes into an independent JS `ArrayBuffer` before creating a `Blob` to prevent detached buffer exceptions.
4. **Baseline Geometry**:
   - PDF user space coordinates have origin (0, 0) at the bottom-left.
   - Viewport pixels have origin at top-left.
   - Live canvas preview must use `ctx.textBaseline = "alphabetic"` anchored to the exact baseline `vy` to prevent vertical text jumping.

---

## 4. Daily Commands

```bash
# Start local development server
pnpm dev

# Build production bundle (includes Web Workers and WebAssembly)
pnpm build

# Run unit tests
pnpm test

# Run linter
pnpm lint

# Security audit
pnpm audit

# Run POC-001 stream replacement verification script
pnpm poc:001
```

---

## 5. Verification Checklist Before Committing
- [ ] `pnpm test` passes 100%.
- [ ] `pnpm build` completes with 0 errors.
- [ ] `pnpm lint` passes with 0 errors or warnings.
- [ ] `pnpm audit` reports 0 vulnerabilities.
- [ ] No em dashes used anywhere.
