# Human Deficit-Language Coding Tool

A small local web app for **two researchers to independently code** classroom
transcripts for deficit-based teacher language (categories A–G + Other), then
**compare and adjudicate** their codings against each other and against the LLM
pipeline output (Study 2).

It's the human-coding companion to `scripts/deficit_analysis.py`: same corpus,
same categories, same verbatim-quote discipline — but the judgments come from
people, so the automated findings can be validated and a gold standard built.

## Run it

```bash
pip install -r requirements.txt          # from repo root (Flask; anthropic optional)
python tools/coder/app.py                # or: py tools/coder/app.py
# open http://localhost:5000
```

Works on Python 3.13+. Flask is the only hard dependency. The tool reuses the
pipeline's `load_transcript` / quote-verification when `anthropic` is installed;
if it isn't, it falls back to identical built-in copies, so it still runs.

## Workflow

1. **Code (blind).** Each coder enters their id, picks a transcript, and clicks
   *Load / Resume*. Scroll the transcript; **click a teacher turn** to flag it,
   tick one or more categories (A–G / Other), set confidence, add a note.
   Optionally select text in the turn and *Use selected text as quote* to record
   the exact span (otherwise the whole turn is the quote). Student turns are
   context only. The LLM's flags are **not shown here** — coding is blind.
2. **Autosave.** Changes save to `data/human_coding/<video>/<coder>.json` about a
   second after you stop typing, with a `localStorage` mirror as a crash net.
   Reopen the same transcript+coder to resume where you left off.
3. **Compare.** On the *Compare & Adjudicate* tab pick the transcript and two
   coders. You get agreement stats and every flagged turn colour-coded:
   green = agree, amber = both flagged but categories differ, red = only one
   flagged. Tick *include LLM* (after *Import LLM scenes*) to add a third column.
4. **Adjudicate.** Each row has an editor pre-filled from the two codings. Adjust
   categories/notes, keep *include* ticked for the ones that belong in the gold
   standard, and click *Save adjudicated.json*.

## Reading the agreement stats (important)

Flagging is rare relative to the ~1,400 teacher turns in a transcript, so **raw
agreement is misleadingly high and Cohen's κ is misleadingly low** (the "kappa
paradox"). Read them together:

| Stat | What it tells you |
|------|-------------------|
| Raw agreement | inflated — dominated by the many turns *neither* flagged |
| Cohen's κ | chance-corrected, but pessimistic when flags are rare |
| PABAK | κ adjusted for prevalence/bias |
| **Positive agreement** | Dice/F1 on the flags themselves — the honest headline |
| Category Jaccard | given both flagged a turn, how much categories overlap |

Do not report κ alone.

## File layout

```
data/human_coding/<video_id>/
  <coder_id>.json      # one per coder (autosave target; the handoff artifact)
  llm.json             # LLM scenes imported as a third "coder"
  adjudicated.json     # reconciled gold standard
```

### Per-coder JSON

```json
{
  "video_id": "309",
  "coder_id": "gordon",
  "created_at": "2026-07-15T12:00:00",
  "updated_at": "2026-07-15T12:34:00",
  "progress": { "last_turn_viewed": 640, "completed": false },
  "scenes": [
    {
      "scene_id": "t227",
      "turn": 227,
      "speaker": "teacher",
      "verbatim_quote": "those people that are not paying attention ...",
      "quote_verified": true,
      "categories": ["D", "E"],
      "other_label": "",
      "note": "predicts failure before task attempted",
      "confidence": "high",
      "flagged_at": "2026-07-15T12:10:00"
    }
  ]
}
```

`turn` matches the numbering in `scripts/deficit_analysis.py` exactly (1-based over
all CSV rows, keeping only rows with both a speaker and text — so numbers can have
gaps). This is what lets human flags line up with LLM scenes turn-for-turn.

## Categories (A–G, + Other)

Defined in `prompts/deficit_language_analysis_spec.txt` — the source of truth:
A Fixed-Ability · B Deficit Labeling/Grouping · C Problem in Student/Home/Background ·
D Deficit Attribution (Behavior/Motivation) · E Lowered Expectations ·
F Comparative Deficit · G Totalizing Negation.
