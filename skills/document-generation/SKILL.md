---
name: document-generation
description: Create and edit real document files — DOCX, XLSX, PPTX, PDF — with correct structure, styling, and compatibility. Use when asked to produce a Word doc, Excel spreadsheet with formulas, PowerPoint deck, or fill/edit a PDF. Ported from Claude's document-skills corpus, deepened with validation and compat rules.
---

# Document Generation Procedure

Documents must open correctly in real Office/LibreOffice/Preview — not just be structurally valid XML. Generate with libraries, verify by re-reading.

## 1. Choose the right format (and say so)
- DOCX for editable prose, XLSX for computation, PPTX for presentations, PDF only when the consumer needs fixed layout (forms, print, legal) — PDF is a delivery format, not an editing format.
- If the user says "spreadsheet", ask yourself if a CSV suffices — plain data beats a binary wrapper.

## 2. DOCX (python-docx or docx npm equivalent)
- Structure first: heading levels (Heading 1-3) create the navigation pane and TOC — style names matter more than visual size.
- Styles over direct formatting: modify the style, apply the style. Direct-formatted runs make global restyling impossible.
- Tables: fixed layout with explicit column widths (in inches/EMU), header row repeat on page breaks (`tblHeader`), cell margins consistent.
- Page setup: margins, orientation, and section breaks BEFORE content — retrofitting breaks numbering.
- Verify: unzip the file, check `document.xml` parses; open in LibreOffice headless (`soffice --convert-to pdf`) to prove renderability.

## 3. XLSX (openpyxl or exceljs)
- Formulas as formulas (`=SUM(B2:B10)`), not precomputed values — the whole point of a spreadsheet is recomputation.
- Named the ranges you reference; freeze header panes; set column widths from max content length; number formats (`#,##0.00`, dates as real dates not strings).
- Data validation and conditional formatting for anything a human edits.
- Recalc caution: openpyxl writes formulas without cached values — either compute with `formulas`/`libreoffice --calc` roundtrip or note that the first open recalculates.
- Verify: reopen with the library, assert key cells + formulas exist, and confirm no `#REF!` targets.

## 4. PPTX (python-pptx)
- Slide layout from the template's layouts (Title Slide, Title and Content) — never blank slides with manual text boxes for standard content.
- One idea per slide, <=6 bullet lines, <=8 words per bullet in the notes-free body; the detail goes in speaker notes.
- Fonts embedded or universal (Arial/Calibri class); images sized to placeholder aspect, never stretched.
- Verify: slide count, no text overflowing placeholder bounds (compare shape extents), consistent margins across slides.

## 5. PDF
- Generation: from HTML via headless Chromium (`--print-to-pdf`) for rich layout, or reportlab/fpdf2 for programmatic forms. Set PDF/A for archival when asked.
- Forms: AcroForm fields with names (not widget soup), tab order top-to-bottom, tooltips as field descriptions.
- Text must be selectable/searchable — an image-only PDF is a scan, not a document (add OCR layer when only scans exist).

## 6. Universal verification
- Roundtrip open: every generated file is re-read programmatically and the key invariants asserted (sheet names, heading count, slide count, page count).
- File size sanity: a 5-page DOCX at 12MB means embedded bloat — compress images.
- Compatibility targets: LibreOffice + MS Office both render; if the user is on Apple, iWork opens DOCX/XLSX with quirks — test margins/footnotes.

## Pitfalls
- Building documents by string-templating XML: one unescaped `&` corrupts the whole file. Always go through the library API.
- Charts pasted as images when native chart objects were expected (loses editability).
- Locale traps: Excel date coercion mangles ISO dates — set text format on data columns explicitly.
