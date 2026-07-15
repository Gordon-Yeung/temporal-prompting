# Classroom Discourse × LLM Analysis

This repository hosts **two related studies** that use LLMs (Claude Opus) to analyze
elementary-classroom mathematics transcripts. They share the same transcript data and
the same working principle — *Claude does the language analysis; every claim is verified
against the source* — but they answer different questions:

| Study | Question | Scope |
|-------|----------|-------|
| **1. Temporal Prompting** | Does prompting an LLM to treat a transcript as *temporally ordered* change the thematic analysis it produces? | 2 fully-coded cases (706, 543) |
| **2. Deficit-Language Analysis** | *Where* in these classrooms does deficit-based teacher language actually occur? | All 52 transcripts |

Study 1 is **methodological** (does prompt framing change the output?).
Study 2 is **substantive** (what does the corpus contain?).

---

# Study 1 — Temporal Prompting in Educational Transcripts

Investigates how adding a **temporal dimension** to LLM prompts changes the quality and
character of thematic analyses of classroom discourse.

## Research Question

Does prompting an LLM to track how teacher orientations *shift over time* — rather than
treating the transcript as a static document — produce qualitatively different thematic
analyses? How does this interact with the type of input provided (raw transcript vs.
human-coded turn-level orientations)?

## Background

Each turn in a classroom transcript can be coded for the teacher's implicit orientation
across three dimensions:

- **Orientation about Mathematics** — what the teacher's talk implies about the nature of math (e.g., procedural, problem-solving, multimodal)
- **Orientation about Students** — how the teacher positions students (e.g., as agents, as holders of prior knowledge, as a collective)
- **Orientation about Interaction** — the interactional structure the teacher constructs (e.g., collaborative, directive, time-structured)

Human coders applied these labels turn-by-turn. This study tests four conditions for
automating or augmenting that thematic analysis using LLMs.

## Experimental Conditions

The four conditions form a 2×2 matrix (input type × prompt framing):

| ID | Name | Input | Prompt Style |
|----|------|-------|--------------|
| 01 | Static Codes | Human-coded orientations | Generic thematic analysis |
| 02 | Temporal Codes | Human-coded orientations | Temporal shift framing |
| 03 | Static Transcript | Raw classroom transcript | Generic thematic analysis |
| 04 | Temporal Transcript | Raw classroom transcript | Temporal shift framing |

**Temporal prompting** (conditions 02 and 04) explicitly asks the model to attend to how
orientations evolve across the lesson rather than treating all turns as equivalent.

Comparisons of interest:
- **Static vs. Temporal**: 01↔02 or 03↔04 (same data, different prompt)
- **Coded vs. Transcript**: 01↔03 or 02↔04 (different data, same prompt)
- **Full matrix**: all four, to isolate each effect

## Data

Two elementary classroom video transcripts serve as the fully-coded cases. These are the
only two videos with human-coded orientation files, so conditions 01/02 (which require
coded input) run only for these:

| Video ID | Lesson Topic | Notes |
|----------|-------------|-------|
| 706 | Fractions / word problems | Grades 3–5, structured launch–work–share |
| 543 | Multiplication / scriptwriting | Grades 3–5, creative math storytelling |

## Running a Condition

### Prerequisites

```bash
pip install anthropic
export ANTHROPIC_API_KEY="your-key-here"     # or set it in a .env file
```

### Single condition

```bash
python scripts/run_condition.py --video_id 706 --condition 01
```

| Flag | Required | Description |
|------|----------|-------------|
| `--video_id` | Yes | `706` or `543` |
| `--condition` | Yes | `01`, `02`, `03`, or `04` |
| `--output_dir` | No | Where to save output (default: `data/analysis/`) |
| `--save` | No | Save output to a timestamped file |

### All four conditions for a video

```bash
python scripts/run_all_conditions.py --video_id 706
```

This runs conditions 01–04 sequentially, saves each output to `data/results/<video_id>/`,
and writes a `manifest.json` recording condition, data source, prompt file, output path,
timestamp, and status.

### Viewing results

```bash
python scripts/view_results.py --video_id 706                 # summary of all conditions
python scripts/view_results.py --video_id 706 --condition 02  # one condition's output
```

## Adding a New Condition

1. Write your prompt to `prompts/condition_XX_<slug>.txt`
2. Add an entry to `prompts/conditions.json`:

```json
"05": {
  "name": "Your Condition Name",
  "description": "What distinguishes this condition.",
  "input_type": "coded",
  "prompt_file": "prompts/condition_05_your_slug.txt"
}
```

3. Run: `python scripts/run_condition.py --video_id 706 --condition 05`

`input_type` must be either `"coded"` (uses `data/coded/<video_id>_coded.csv`) or
`"transcript"` (uses `data/transcripts/<video_id>_original.csv`).

## Study 1 Outputs

- `data/analysis/<video_id>_analysis.csv` — original wide-format results (one column per
  condition; first rows are metadata: condition name, prompt used, researcher comments).
- `data/results/<video_id>/` — outputs from the scripted pipeline, plus `manifest.json`.

See `RESULTS.md` for the full results-organization guide.

---

# Study 2 — Deficit-Language Analysis

A batch analysis that scans **every** transcript in the corpus (52 files) and flags
instances of **deficit-based teacher language** — talk that locates the problem *inside
the student* (as a stable trait or background limitation) rather than in the task,
the moment, or the instruction.

## What It Detects

Seven categories of deficit framing (A–G):

| Code | Category | Example |
|------|----------|---------|
| A | Fixed-ability framing | "she's just not a math person" |
| B | Deficit labeling / grouping | "my low kids", "the ones who can't…" |
| C | Problem in student/home/background | "they come from homes where…" |
| D | Deficit attribution for behavior/motivation | "he's lazy", "you're not trying" |
| E | Lowered expectations | reducing cognitive demand due to assumed inability |
| F | Comparative deficit | "not as good as last year's class" |
| G | Totalizing negation | "she doesn't get any of it" |

The full criteria — including what is **not** deficit language (neutral error
description, factual assessment, high-demand questioning, encouragement) and the
high/medium/low confidence rubric — are specified in
`prompts/deficit_language_analysis_spec.txt`. That spec is the source of truth for this study.

## Method (built for research-grade correctness)

- **Conservative by design.** A false positive is treated as worse than a miss.
  Ambiguous cases are flagged "low" confidence with the tension explained, or not flagged.
- **Mandatory quote verification.** Every quoted utterance is string-matched back into the
  source transcript (whitespace/case normalized); any scene whose quote can't be located
  verbatim is dropped and logged to `skipped_quotes.log`.
- **Full source attribution.** Each scene records source document, turn number(s), the
  verbatim span, ±3 turns of context, category codes, a rationale, and a confidence level.
- **Never stops early.** Per-file errors are logged to `errors.log` and processing continues.

## Running It

```bash
pip install anthropic
export ANTHROPIC_API_KEY="your-key-here"
python scripts/deficit_analysis.py
```

> **Note:** `scripts/deficit_analysis.py` currently hard-codes absolute input/output paths
> near the top of the file (`INPUT_DIR` / `OUTPUT_BASE`). Update these to match your local
> checkout before running.

Output goes to a timestamped folder `data/deficit_scenes/run_YYYY-MM-DD_HHMMSS/` so prior
runs are never overwritten:

| File | Contents |
|------|----------|
| `<source>.deficit.json` | One file per transcript (empty `scenes: []` if none found) |
| `all_scenes.json` | Flat array of every scene across all documents |
| `run_summary.csv` | Per-file counts: scenes found + high/medium/low confidence |
| `DEFICIT_ANALYSIS_REPORT.md` / `.txt` | Human-readable report with quotes and context |
| `skipped_quotes.log` | Quotes that failed verification (only if any) |
| `errors.log` | Processing errors (only if any) |

## Latest Run

`data/deficit_scenes/run_2026-07-12_170210/`:

- **52** transcripts analyzed
- **68** deficit scenes identified
- **38** transcripts contained at least one flagged instance

---

## Repository Layout

```
temporal-prompting/
├── data/
│   ├── transcripts/          # 52 raw speaker-turn CSVs (<video_id>_original.csv)
│   ├── coded/                # Human-coded turn-level orientations (706, 543 only)
│   ├── analysis/             # Study 1 wide-format outputs (one column per condition)
│   ├── results/              # Study 1 scripted-pipeline outputs + manifest.json
│   └── deficit_scenes/       # Study 2 timestamped run folders
├── prompts/
│   ├── conditions.json                       # Study 1 condition registry
│   ├── condition_01..04_*.txt                # Study 1 prompts
│   └── deficit_language_analysis_spec.txt    # Study 2 spec (source of truth)
├── scripts/
│   ├── run_condition.py          # Study 1: run one condition
│   ├── run_all_conditions.py     # Study 1: run all four for a video
│   ├── view_results.py           # Study 1: view/summarize results
│   └── deficit_analysis.py       # Study 2: batch deficit-language scan
├── CLAUDE.md                 # Technical guide for Claude Code
├── RESULTS.md                # Study 1 results-organization guide
└── README.md
```

## Data Schemas (quick reference)

- **`data/transcripts/<id>_original.csv`** — raw turns. Column names vary: video 706 uses
  `speaker, text, video_id`; video 543 uses `speaker, cleaned_text`. Both loaders normalize
  the text column and strip UTF-8 BOM.
- **`data/coded/<id>_coded.csv`** — `speaker, Utterance, Orientation about Mathematics,
  Orientation about Students, Orientation about Interaction`. Episode headers and blank-speaker
  researcher commentary appear as inline rows (metadata, not turns).

See `CLAUDE.md` for the full schema and pipeline details.

## Requirements

- Python 3.9+ (project targets 3.13; avoid 3.14-alpha — SDK incompatibilities)
- `anthropic` Python SDK (`pip install anthropic`)
- `ANTHROPIC_API_KEY` environment variable (or a `.env` file)
- Model: `claude-opus-4-8` with adaptive thinking and streaming
</content>
</invoke>
