# CLAUDE.md — Technical Guide for Claude Code

This file tells Claude Code how the project is structured so it can assist accurately.

## What This Project Does

This repo holds **two related studies** over the same classroom-transcript corpus. See README.md for the full research framing.

- **Study 1 — Temporal Prompting.** Tests four prompting conditions for LLM-based thematic analysis. The core variable is whether the prompt asks the model to treat turn-level data as temporally ordered (tracking how teacher orientations *shift*) versus as a static document. Runs only on the two fully-coded cases (706, 543). Driven by `scripts/run_condition.py` / `run_all_conditions.py`.
- **Study 2 — Deficit-Language Analysis.** Batch-scans *all* transcripts for deficit-based teacher language across seven categories, with mandatory verbatim quote verification. Driven by `scripts/deficit_analysis.py`; criteria live in `prompts/deficit_language_analysis_spec.txt`.

The two studies share transcript data and the same principle — Claude does the language analysis, every claim is verified against source — but answer different questions (Study 1 is methodological; Study 2 is substantive).

## Data Schemas

### `data/transcripts/<video_id>_original.csv`

Raw speaker-turn transcripts. Column names differ between the two cases:

| Video | Columns |
|-------|---------|
| 706 | `speaker`, `text`, `video_id` |
| 543 | `speaker`, `cleaned_text` |

The text column contains the verbatim (or lightly cleaned) teacher/student speech. `speaker` values include `teacher`, `student`, `multiple students`.

### `data/coded/<video_id>_coded.csv`

Human-coded turn-level orientations. Both files share this schema:

```
speaker, Utterance, Orientation about Mathematics, Orientation about Students, Orientation about Interaction
```

Episode headers appear as inline rows (e.g., `Episode 1: The launch,,,,`). Rows where the speaker is blank are researcher commentary inserted between episodes — treat them as metadata, not turns. Orientation columns are free-text; they may be empty for student turns.

### `data/analysis/<video_id>_analysis.csv`

Wide-format outputs. Each condition occupies one column. The first few rows are:
- Row 1: video/dataset label
- Row 2: condition names (`Static Codes`, `Temporal Codes`, etc.)
- Row 3: prompt text used
- Row 4: researcher comment field
- Row 5+: thematic content (themes and elaborations)

Do not treat this as a standard row-indexed table. When appending a new condition result, add a column to the right.

### `data/deficit_scenes/run_<YYYY-MM-DD_HHMMSS>/` (Study 2 output)

Each run is a **timestamped folder** — never overwrite a prior run. Contents:

| File | Contents |
|------|----------|
| `<source>.deficit.json` | Per-transcript scenes (empty `scenes: []` if none) |
| `all_scenes.json` | Flat array of every scene across all documents |
| `run_summary.csv` | `source_document_id, scenes_found, high_conf, medium_conf, low_conf` |
| `DEFICIT_ANALYSIS_REPORT.md` / `.txt` | Human-readable report |
| `skipped_quotes.log` / `errors.log` | Only written if there were skips/errors |

Per-scene JSON shape: `turn_range`, `deficit_span` (`speaker`, `turns`, `verbatim_quote`), `context_excerpt` (±3 turns), `categories` (A–G), `rationale`, `confidence` (`high`/`medium`/`low`). Full shape is defined in `prompts/deficit_language_analysis_spec.txt`.

## Conditions Registry

`prompts/conditions.json` is the single source of truth for all conditions:

```json
{
  "01": {
    "name": "Static Codes",
    "description": "...",
    "input_type": "coded",       // "coded" | "transcript"
    "prompt_file": "prompts/condition_01_static_codes.txt"
  },
  ...
}
```

`input_type` controls which data file the pipeline script loads:
- `"coded"` → `data/coded/<video_id>_coded.csv`
- `"transcript"` → `data/transcripts/<video_id>_original.csv`

## Pipeline Script

`scripts/run_condition.py` handles the full condition run:

```
python scripts/run_condition.py --video_id 706 --condition 01 [--save] [--output_dir data/analysis/]
```

It reads `conditions.json`, loads the right input file, appends the prompt, calls `claude-opus-4-8` with adaptive thinking and streaming, and prints the response. Pass `--save` to write the output to a timestamped `.txt` file.

## Adding a New Condition

1. Write the prompt to `prompts/condition_XX_<slug>.txt`
2. Register it in `prompts/conditions.json` (see schema above)
3. Run the pipeline script — no code changes needed

## Deficit-Language Pipeline (Study 2)

`scripts/deficit_analysis.py` scans **every** transcript in `data/transcripts/` and flags
deficit-based teacher language. Run it with:

```
python scripts/deficit_analysis.py
```

Key facts for anyone editing this script:

- **Paths are hard-coded** at the top (`INPUT_DIR`, `OUTPUT_BASE`) and currently point at a
  different user's checkout (`C:\Users\Gordon Yeung\...`). They must be corrected to the
  local checkout before the script runs. Prefer making them repo-relative if you touch this.
- **Same CSV loader concerns as Study 1**: handles UTF-8 BOM and both column schemas
  (`text` vs `cleaned_text`).
- **The system prompt is the criteria.** `ANALYSIS_SYSTEM_PROMPT` in the script mirrors
  `prompts/deficit_language_analysis_spec.txt`. If you change detection behavior, keep the
  script prompt and the spec in sync — the spec is the source of truth.
- **Quote verification is mandatory and must not be weakened.** Every scene's
  `verbatim_quote` is normalized and matched back into the source; unmatched scenes are
  dropped and logged. This is a research-integrity guarantee, not an optimization.
- **Conservative bias is intentional.** A false positive is worse than a miss. Do not tune
  toward higher recall without researcher sign-off.
- Uses `claude-opus-4-8` with adaptive thinking; `CONTEXT_TURNS = 3` controls the context window per scene.

## Naming Conventions

| Artifact | Pattern | Example |
|----------|---------|---------|
| Prompt file | `condition_NN_<slug>.txt` | `condition_05_temporal_coded_v2.txt` |
| Condition key | Two-digit zero-padded string | `"05"` |
| Transcript | `<video_id>_original.csv` | `706_original.csv` |
| Coded file | `<video_id>_coded.csv` | `543_coded.csv` |
| Analysis | `<video_id>_analysis.csv` | `706_analysis.csv` |

## API Usage

The pipeline uses the Anthropic Python SDK with:
- Model: `claude-opus-4-8`
- Thinking: `{"type": "adaptive"}` (model decides depth)
- Streaming: yes — transcripts can be large; streaming prevents timeout

The `ANTHROPIC_API_KEY` environment variable must be set. The script does not hard-code the key.

## What NOT to Change Without Researcher Sign-Off

- Column names in coded CSVs (downstream analysis depends on exact headers)
- The `input_type` values in `conditions.json` (must stay `"coded"` or `"transcript"`)
- The episode/commentary row structure in coded CSVs
- The verbatim quote-verification step in `deficit_analysis.py` (research-integrity guarantee)
- The deficit category definitions (A–G) or confidence rubric in `deficit_language_analysis_spec.txt`
- The timestamped-run-folder convention for `data/deficit_scenes/` (prior runs must never be overwritten)

## How to Work with Claude Code

### Collaboration Style

- **Be direct.** Tell me what you need; I'll figure out the best path.
- **Ask for cleanup explicitly.** Don't assume I'll remove test files or failed runs—ask and I will.
- **Prefer outputs in multiple formats.** If a report is useful, offer it as `.md`, `.txt`, `.csv`, or `.json` depending on the use case.
- **Verify rigorously.** For data processing tasks, I should always verify outputs (e.g., quote matching against source), not just trust the analysis.
- **Use Python for data processing.** I write deterministic scripts when handling files, transcripts, or structured data—not ad-hoc one-off commands.

### Technical Preferences

- **Handle CSV parsing robustly.** Expect UTF-8 BOM, quoted column names, multiple schema variants—normalize them.
- **Use Claude Opus for heavy lifting.** Complex language analysis (deficit framing, semantic understanding) uses Opus; I (Haiku) orchestrate.
- **Python 3.13+.** Use the stable Python 3.13 release; avoid alpha versions (3.14-alpha has SDK incompatibilities).
- **Environment variables via `.env`.** Store secrets in `.env` (already in .gitignore); I'll read them at runtime.
- **Timestamp output directories.** When a process can be re-run, use timestamped folders to avoid overwriting prior runs.

### Reporting & Cleanup

- **Generate reader-friendly reports.** Complex JSON outputs should have a human-readable summary (Markdown preferred).
- **Remove temporary files.** Test scripts, failed runs, and cache directories should be cleaned up after debugging.
- **Preserve the audit trail in code.** Comments in scripts should explain *why*, not *what*; good variable names handle the latter.

### Scope & Boundaries

- **Research-grade work.** This project is academic research—prioritize correctness and transparency over speed.
- **No destructive shortcuts.** Don't use `--no-verify` or similar flags to bypass safety checks; fix the underlying issue instead.
- **Check with you on big decisions.** Before deleting large datasets, changing schemas, or refactoring pipelines, ask first.
