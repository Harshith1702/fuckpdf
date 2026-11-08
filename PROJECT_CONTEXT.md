# PDF editor: project context

Read this file fully before writing code. It is the source of truth for scope, architecture and decisions. If something here conflicts with your assumptions, this file wins. If something is missing, add it to the "Open questions" section and ask. Do not guess.

Items marked **[ASSUMED]** are proposed defaults. Change them only with approval.

---

## 1. Product vision

A browser based PDF editor that edits the **real PDF content**, not an overlay on top of it.

Click on existing text, change it, and the output PDF contains that new text in the original font, position and style. Same for images and simple vector objects. No flattening, no "whiteout box plus new text" hack.

### Who it is for

- People who need to fix a typo, date or price in a PDF they did not author.
- Students and freelancers editing invoices, resumes, certificates and forms.
- Developers who want an embeddable editing core.

### What success looks like

- Edit text in a typical digital PDF and export it. The result looks identical to the original except for the edit.
- Original fonts are reused whenever possible.
- Exported files open cleanly in Acrobat, Preview, Chrome, pdf.js and mupdf.
- Everything runs client side. No file leaves the user's machine in the default setup.

### Non goals (v1)

- Editing scanned PDFs or OCR.
- Full desktop publishing features (columns, flowing text across pages, styles).
- Real time collaboration.
- Digital signature creation or validation.
- Editing encrypted PDFs that need a password the user does not have.
- Mobile first UI. Desktop browsers come first.

---

## 2. Requirements

### Functional

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Open a PDF from disk (file picker, drag and drop) | P0 |
| F2 | Render pages with zoom, scroll and page thumbnails | P0 |
| F3 | Detect text runs and show them as editable regions on hover and click | P0 |
| F4 | Edit text in place, with the original font when glyphs are available | P0 |
| F5 | Fall back to an embedded substitute font when glyphs are missing | P0 |
| F6 | Move, resize, delete and replace images | P1 |
| F7 | Add new text boxes and images | P1 |
| F8 | Undo and redo across all edit types | P0 |
| F9 | Export a valid PDF with edits written into the content streams | P0 |
| F10 | Page operations: reorder, delete, rotate, insert blank | P2 |
| F11 | Edit simple shapes (rect, line fill and stroke colors) | P2 |
| F12 | Annotations and form field editing | P3 |

### Non functional

- Open a 50 page text PDF in under 2 seconds on a mid range laptop. **[ASSUMED]**
- Keep UI at 60 fps while scrolling. Heavy work runs in Web Workers.
- Handle files up to 100 MB without crashing the tab. **[ASSUMED]**
- Never mutate the original bytes in memory. All edits are an overlay model that is applied at export.
- Deterministic export. Same input and same edits give byte stable output where possible.

---

## 3. Core user experience

1. User drops a PDF. Pages render.
2. Hovering text shows a subtle box around the run. Cursor changes.
3. Click enters edit mode. A caret appears. The user types.
4. A small toolbar shows font name, size, color, bold, italic. Font name shows the *actual* PDF font, with a warning badge if glyphs are missing.
5. Changes are visible live on the canvas.
6. Export button writes the PDF. A report lists anything that was substituted or could not be edited.

### UX rules

- Never silently swap a font. Always tell the user.
- Never lose edits. Autosave the edit model to IndexedDB.
- Keep keyboard parity: arrows, shift select, ctrl/cmd + z, ctrl/cmd + shift + z, delete.
- Edit mode must feel like a text field, not like a canvas hack.

---

## 4. Technical architecture

### High level

```
            +---------------------------+
            |         UI (React)        |
            |  viewer, toolbar, panels  |
            +-------------+-------------+
                          |
                 commands | events
                          v
            +---------------------------+
            |       Editor core         |
            |  document model, history, |
            |  selection, commands      |
            +------+------------+-------+
                   |            |
         worker RPC|            |worker RPC
                   v            v
        +----------------+  +--------------------+
        | Render worker  |  |  PDF engine worker |
        | pdf.js canvas  |  | parse, edit, write |
        +----------------+  +--------------------+
                                     |
                                     v
                          +---------------------+
                          | Font service        |
                          | extract, subset,    |
                          | fallback, shaping   |
                          +---------------------+
```

### Layers

**UI layer.** React components only. No PDF logic. Talks to the editor core through commands and subscriptions.

**Editor core.** Pure TypeScript. Owns the document model, selection, undo stack and command dispatch. No DOM access. Fully unit testable in Node.

**PDF engine.** Parses the PDF, builds a semantic model of page content, applies edits to content streams, and serializes. Runs in a worker.

**Render layer.** Draws pages for display. Uses a separate renderer so the engine can stay focused on structure.

**Font service.** Extracts embedded fonts, checks glyph coverage, subsets and embeds fonts on export.

### Key architectural idea: two models

1. **Source model.** Read only parse of the original PDF (objects, content streams, resources).
2. **Edit model.** A list of operations (change text run X to "foo", move image Y by dx, dy). Stored as JSON. This is what undo and autosave work on.

On export: `source model + edit model -> new content streams + new resources -> PDF bytes`.

This keeps undo cheap, keeps the original safe, and makes export testable (feed in fixtures, assert on output).

---

## 5. Technology stack **[ASSUMED]**

| Area | Choice | Why |
|------|--------|-----|
| Language | TypeScript (strict) | Shared types between UI, core and workers |
| Build | Vite | Fast dev, simple worker support |
| UI | React 18 | Common, easy for contributors |
| State | Zustand for UI state, custom store for editor core | Core must not depend on React |
| Rendering | pdf.js (`pdfjs-dist`) | Mature, accurate canvas rendering |
| PDF parsing and writing | MuPDF WASM (`mupdf`) as primary engine | Strong content stream access and robust writing |
| Object level helpers | `pdf-lib` for simple tasks (page ops, metadata) only | Easy API, but weak on content stream editing |
| Fonts | `fontkit` for reading and subsetting, `harfbuzzjs` for shaping | Needed for glyph coverage and complex scripts |
| Storage | IndexedDB via `idb` | Autosave edit model |
| Tests | Vitest (unit), Playwright (e2e), pixel diff with `pixelmatch` | Visual regression is critical here |
| Lint and format | ESLint, Prettier | Standard |
| Package manager | pnpm | Workspace support |

### Library decisions to respect

- **Do not** use an HTML overlay plus whiteout as the editing strategy. It is the thing this project exists to avoid.
- **Do not** rasterize pages into the output.
- pdf.js is for **display only**. Do not try to write PDFs with it.
- pdf-lib is allowed for page level operations. Do not build text editing on top of it. Its content stream support is too thin.
- If MuPDF WASM turns out to block a requirement, record it in `docs/decisions/` as an ADR before switching.

---

## 6. PDF parsing and native editing engine

This is the hard part. Read carefully.

### 6.1 What "native editing" means

A page's visible text is produced by operators in a content stream:

```
BT
/F1 12 Tf
72 700 Td
(Hello world) Tj
ET
```

Native editing means we change the operands and operators in that stream (and the font resources it points to), then write the file back. We do not paint over it.

### 6.2 Pipeline

1. **Load.** Read the file. Resolve xref (tables, streams and hybrid), object streams, incremental updates.
2. **Page tree walk.** Collect pages, inherited resources, MediaBox, CropBox, rotation.
3. **Content stream decode.** Concatenate the page's content streams. Decode filters (Flate, LZW, ASCII85, ASCIIHex at minimum).
4. **Tokenize and interpret.** Run a graphics state interpreter:
   - Track CTM, text matrix, text line matrix, font, font size, char spacing, word spacing, horizontal scale, leading, rise, render mode.
   - Handle `q`, `Q`, `cm`, `BT`, `ET`, `Tf`, `Td`, `TD`, `Tm`, `T*`, `Tc`, `Tw`, `Tz`, `TL`, `Ts`, `Tj`, `TJ`, `'`, `"`.
   - Handle `Do` for Form XObjects (recurse) and images.
5. **Build the semantic model.** Convert raw operators into higher level objects:
   - `TextRun`: contiguous glyphs sharing font, size and baseline.
   - `TextLine`: runs on one baseline.
   - `TextBlock`: lines grouped by spacing and alignment.
   - `ImageObject`, `PathObject`, `FormObject`.
   - Every object keeps a pointer back to its source operator range (stream id, byte start, byte end).
6. **Apply edits.** For each edit, rewrite the operator range for the affected object.
7. **Serialize.** Write new streams, new or updated resources and a new xref. Prefer full rewrite for v1. Incremental update is a later option.

### 6.3 Text edit rules

- **Same line edit.** Replace the string operand(s). Recompute `TJ` kerning arrays. Keep font, size and position.
- **Width change.** Do not reflow other lines in v1. If the new text is longer than the available width, warn the user, then allow overflow.
- **Alignment.** Remember if the run was left, center or right aligned (inferred from block geometry). Keep the anchor point stable.
- **Multi line blocks.** v1 edits one line at a time. Pressing Enter inside a line splits into a new `TextLine` placed using the block's detected leading.
- **Encoding.** Map unicode to the font's character codes via its CMap or encoding. If a char has no code in the embedded subset, go to the font fallback path (section 7).
- **Type 3 fonts, vertical writing, and Type 0 fonts with unknown CMaps** are read only in v1. Show them as non editable with a clear reason.

### 6.4 Image edit rules

- Images live behind `Do` operators, with a CTM that defines position and size.
- Move or resize: rewrite the `cm` before the `Do`.
- Replace: add a new image XObject, point the `Do` at it, keep the CTM.
- Preserve SMask, color space and decode arrays for untouched images. Never recompress unchanged images.

### 6.5 Hard cases to design for from day one

- Text drawn as one glyph per `Tj` with manual positioning.
- Fonts with custom encodings and no ToUnicode map.
- Text split across multiple content streams in one page.
- Clipping paths wrapping text.
- Text with render mode 1, 2 or 3 (stroke, fill and stroke, invisible).
- Rotated pages and rotated text matrices.
- Optional content (layers).
- Overlapping text (watermarks, shadows done by drawing text twice).

---

## 7. Text, font, image and layout handling

### Font strategy (in order)

1. **Reuse the embedded font.** If the font is embedded and all needed glyphs exist in the subset, just use it. Best result.
2. **Extend the subset.** If the font is embedded as a full font program (not a subset), add the missing glyphs by re-subsetting.
3. **Match a system or bundled font.** If the font is a subset and lacks glyphs, find the closest open font from a bundled set (metrics, weight, style, serif class) and embed that for the **edited run only**. Tell the user.
4. **Last resort.** Let the user pick any bundled font manually.

Bundle a small open font set (Liberation, Noto Sans and Noto Serif, Inter) with SIL OFL or similar licenses. Record licenses in `THIRD_PARTY.md`.

### Font service API (internal)

```ts
interface FontService {
  describe(fontRef: FontRef): FontInfo;                  // name, type, embedded, subset, coverage
  canEncode(fontRef: FontRef, text: string): CoverageResult;
  encode(fontRef: FontRef, text: string): EncodedText;   // codes + widths
  suggestFallback(fontRef: FontRef): FallbackCandidate[];
  embedForExport(fontRef: FontRef, usedGlyphs: Set<number>): EmbeddedFont;
}
```

### Layout rules

- Use the PDF's own glyph widths (`/Widths`, CID widths) for measuring. Do not use the browser's text metrics for PDF content.
- Use HarfBuzz only for fallback fonts that need shaping. For original fonts, trust the PDF's advance widths.
- Keep a spatial index (R-tree) per page for hit testing text runs and images.
- All geometry is stored in PDF user space (points, origin bottom left). Convert at the UI boundary only.

### Image handling

- Decode for display with the renderer. Do not decode in the engine unless replacing.
- Accepted replacement formats: PNG, JPEG, WebP (converted to PNG or JPEG on embed).
- Warn when the replacement has a different aspect ratio. Offer fit, fill and stretch.

---

## 8. Export architecture

```
edit model + source model
        |
        v
  plan changes per page
        |
        v
  rewrite content streams  --->  new stream objects
        |
        v
  collect fonts, images    --->  subset, embed, dedupe
        |
        v
  update resources dicts
        |
        v
  write PDF (full rewrite) ---> xref, trailer, linearization off
        |
        v
  validate (re-open, render, compare)
```

### Export rules

- Only touch pages that have edits. Copy other pages' objects byte for byte when possible.
- Drop unused objects that edits orphaned (old fonts, old images).
- Keep document metadata, outlines, named destinations, page labels and tagged structure where possible.
- Update `/Info` ModDate. Leave Producer as is, or append the app name.
- After write, run a self check: re-open the output with the engine, render edited pages and diff against the live canvas. Fail loudly if the diff passes a threshold.
- Export produces an **export report** (JSON plus a UI summary): edits applied, fonts substituted, objects that could not be edited, warnings.

### Compatibility targets

Output must open without warnings in: Adobe Acrobat Reader, macOS Preview, Chrome PDF viewer, Firefox pdf.js, mupdf, and `qpdf --check` must pass.

---

## 9. Project folder structure

```
pdf-editor/
  PROJECT_CONTEXT.md
  README.md
  THIRD_PARTY.md
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  docs/
    decisions/              # ADRs, one file per decision
    pdf-notes/              # notes on spec quirks found while building
  packages/
    core/                   # editor core, no DOM
      src/
        model/              # document model types
        commands/           # edit commands
        history/            # undo and redo
        selection/
        index.ts
      test/
    engine/                 # PDF parsing and writing
      src/
        parser/             # xref, objects, filters
        interpreter/        # content stream interpreter
        semantic/           # TextRun, TextBlock, ImageObject builders
        edit/               # operator rewriting
        writer/             # serializer
        index.ts
      test/
    fonts/
      src/
        extract/
        coverage/
        subset/
        fallback/
        bundled/            # open font files
      test/
    render/
      src/                  # pdf.js wrapper, tile and cache logic
    ui/                     # React components
      src/
        viewer/
        toolbar/
        panels/
        hooks/
  apps/
    web/                    # Vite app that wires everything together
      src/
        workers/
        main.tsx
  fixtures/
    pdfs/                   # test PDFs, grouped by feature
    expected/               # expected outputs and golden renders
  tools/
    compare-render.ts
    inspect-pdf.ts          # dumps operators for debugging
  e2e/                      # Playwright tests
```

### Dependency rules

- `core` depends on nothing except types.
- `engine` and `fonts` may depend on `core` types only.
- `ui` depends on `core` and `render`. Never on `engine` directly.
- `apps/web` is the only place that wires workers to the UI.

---

## 10. Implementation phases and milestones

| Phase | Goal | Exit criteria |
|-------|------|---------------|
| 0. POC | Prove native text edit is feasible | POC-001 passes (section 13) |
| 1. Viewer | Open and render PDFs smoothly | Zoom, scroll, thumbnails, 60 fps on a 50 page file |
| 2. Text detection | Show editable text runs | Hover boxes match glyph bounds on 20 fixtures |
| 3. Text editing | Edit same line text with original font | 90 percent of fixtures edit and export cleanly |
| 4. Font fallback | Handle missing glyphs | Subset and substitute paths covered by tests and UI warnings |
| 5. Undo, redo, autosave | Reliable editing session | Crash and reload restores edits |
| 6. Images and shapes | Move, resize, replace | Image fixtures pass visual diff |
| 7. New content | Add text boxes and images | New objects export correctly |
| 8. Page operations | Reorder, delete, rotate | Output passes `qpdf --check` |
| 9. Hardening | Edge cases, performance, polish | Test matrix (section 11) green |

Each phase ends with: green tests, updated docs, a short demo GIF in `docs/`.

---

## 11. Testing strategy and edge cases

### Test layers

1. **Unit tests.** Tokenizer, filters, interpreter state, font encode and decode, operator rewriting. Fast, run on every commit.
2. **Golden tests.** For each fixture and each edit script, export a PDF, render with mupdf, compare against a stored image with a small tolerance.
3. **Round trip tests.** Open, export with zero edits, assert the visual result is identical and the file validates.
4. **Cross viewer checks.** CI renders outputs with pdf.js and mupdf and runs `qpdf --check`. Manual spot checks in Acrobat before releases.
5. **E2E.** Playwright drives the real UI: load, click text, type, export, verify.
6. **Fuzz and malformed input.** Truncated files, bad xref, wrong stream lengths. Engine must fail with a clear error, never hang.

### Fixture set (minimum)

- Simple Word export, single font.
- Google Docs export.
- LaTeX output with Type 1 and OpenType fonts.
- InDesign output with many subsets.
- Invoice with tables and right aligned numbers.
- Resume with columns and icons.
- Scanned PDF (must be flagged as not editable).
- Rotated pages (90, 180, 270).
- Right to left text and Indic scripts.
- Ligatures (fi, fl) and small caps.
- Large file (100 MB) and many pages (500).
- Encrypted with empty user password.
- Linearized and incremental update files.
- PDFs with form fields and annotations.

### Edge case checklist

- Replace a word with a longer word.
- Delete all text in a run (remove the operator cleanly, keep BT/ET balanced).
- Insert a character missing from the subset.
- Edit text inside a Form XObject reused on many pages (edit one instance or all? default: this instance only, clone the XObject).
- Edit text under a clip path.
- Overlapping and duplicated text (shadow effects).
- Text with negative or large `Tc`, `Tw`, `Tz`.
- Undo after export, then export again.

---

## 12. Engineering constraints and decisions

### Constraints

- Everything client side by default. No telemetry on file contents.
- Engine and core must run in Node for tests. No hidden DOM dependencies.
- No synchronous heavy work on the main thread.
- Strict TypeScript. No `any` without a comment explaining why.
- No new dependency without a one line reason in the PR description.
- Licenses must be compatible with MIT distribution. Avoid AGPL pieces unless the project license changes. **MuPDF is AGPL. Confirm licensing before shipping.** See open questions.

### Decisions so far

| # | Decision | Reason |
|---|----------|--------|
| D1 | Edit the content stream, no overlays | Core product promise |
| D2 | Two model design (source and edit) | Cheap undo, safe original, testable export |
| D3 | Geometry in PDF user space | One coordinate system, fewer bugs |
| D4 | Full rewrite export for v1 | Simpler and more predictable than incremental updates |
| D5 | One line edits first, no reflow | Reflow is a large problem. Ship value early |
| D6 | Type 3 and vertical text read only in v1 | Rare and costly |
| D7 | pdf.js for display, separate engine for edits | Each tool does what it is good at |

New decisions go in `docs/decisions/NNNN-title.md` using: context, decision, consequences.

### Code style

- Simple, readable code. Small functions. Plain names.
- No clever abstractions before there are two real uses.
- No em dashes in code, comments or docs.
- Comments explain why, not what.
- Errors are typed and carry the object id and page number.

---

## 13. First task: POC-001

**Goal.** Prove we can change one string in a real PDF and export a valid file that renders correctly. No UI.

**Scope**

- Node script in `packages/engine`.
- Input: `fixtures/pdfs/simple-word.pdf` (one page, one font, text only).
- Edit: replace the first text run's string with a different string of similar length.

**Steps**

1. Load the PDF with MuPDF WASM and read page 1 content stream bytes.
2. Write a minimal tokenizer and interpreter that finds the first `Tj` or `TJ`.
3. Print the operator, its byte range, the font name and the decoded text.
4. Replace the string operand with new text encoded through the font's encoding.
5. Write a new content stream, update the page, serialize the PDF.
6. Render before and after with mupdf. Save PNGs.

**Acceptance criteria**

- `pnpm poc:001` runs and writes `out/before.png`, `out/after.png`, `out/edited.pdf`.
- Only the edited text differs in a pixel diff (tolerance 0.1 percent).
- `qpdf --check out/edited.pdf` passes.
- Edited PDF opens in Chrome and Preview with the new text selectable and searchable.
- A short `docs/pdf-notes/poc-001.md` records what was hard, what surprised you and what the next risks are.

**Out of scope for POC-001.** Font fallback, undo, UI, images, multi page, encrypted files.

**Stop and report if**

- The font has no usable encoding or ToUnicode map.
- MuPDF WASM cannot give you raw content stream bytes in a writable form.
- Output differs in anything other than the edited text.

---

## 14. Open questions

Add questions here. Do not block on them unless marked **blocking**.

1. **Blocking before release:** project license versus MuPDF AGPL. Options: open source under AGPL, buy a commercial MuPDF license, or switch the engine to something permissive (for example a custom parser on top of `pdf-lib`'s low level API).
2. Should "edit all instances" of a shared Form XObject be an option in v1?
3. Target browsers: latest Chrome, Edge, Firefox and Safari, or Chromium only for v1?
4. Is a hosted or desktop (Tauri) build planned? It affects file access and size limits.

---

## 15. How to work in this repo (for coding agents)

- Work in small steps. One task per PR. Keep diffs reviewable.
- Before coding a task, restate the goal and list the files you plan to touch.
- Add or update tests with every behavior change.
- Never commit PDFs you do not have the right to share. Use fixtures we generated or that are clearly licensed.
- If the spec in this file is wrong or incomplete, stop and say so. Propose a change to this file in the same PR.
- Update this file when architecture or decisions change. It must stay accurate.
