# BuildAI PDF Extract

Extract text, tables, and structured content from PDF documents. Built for construction workflows — parse specifications, submittals, contracts, RFIs, and any PDF-based project document.

## Usage

When the user uploads or references a PDF and wants to extract its content, use this skill. It handles multi-page documents, tables, and mixed layouts common in construction specs and submittals.

## Scripts

### extract.sh
Extract text and tables from a PDF file. Returns structured output.

```bash
bash skills/buildai-pdf-extract/extract.sh /path/to/document.pdf
```

**Options (via environment variables):**
- `EXTRACT_MODE` — `text` (default), `tables`, or `all`
- `PAGES` — Page range, e.g. `1-5` or `3,7,12` (default: all pages)
- `OUTPUT_FORMAT` — `text` (default) or `json`

**Examples:**

Extract all text from a submittal PDF:
```bash
bash skills/buildai-pdf-extract/extract.sh "/workspace/submittals/mech-submittal-042.pdf"
```

Extract only tables from a specification:
```bash
EXTRACT_MODE=tables bash skills/buildai-pdf-extract/extract.sh "/workspace/specs/division-23.pdf"
```

Extract pages 1-3 as JSON:
```bash
PAGES=1-3 OUTPUT_FORMAT=json bash skills/buildai-pdf-extract/extract.sh "/workspace/contracts/gc-contract.pdf"
```

**Output:**
- `text` mode: Plain text content, one page per section
- `tables` mode: Tables extracted as CSV-formatted blocks
- `all` mode: Text content with tables inline
- `json` format: Structured JSON with pages array, each containing text and tables

**Dependencies:**
- Python 3.8+ (auto-installed: pdfplumber)
- Falls back to pdftotext if pdfplumber unavailable

## Construction Use Cases
- Parse specification sections to find requirements
- Extract submittal data sheets and compare against specs
- Pull key terms from contracts and subcontracts
- Read RFI attachments and drawing notes
- Extract data from inspection reports
- Parse vendor quotes and proposals

## Metadata
- engine-skill: buildai-pdf-extract
- version: 1.0.0
- vendor: BuildAI
- category: Documents
