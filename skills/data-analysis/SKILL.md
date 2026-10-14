---
name: data-analysis
description: Explore and summarize tabular data (CSV/Excel/SQLite) with Python — profiling, cleaning, aggregation, and findings writeups. Use when asked what a dataset shows or to analyze numbers.
---

# Data Analysis Procedure

## Trigger / when to use
Load this skill when asked what a dataset shows, or to explore, clean, aggregate, or summarize tabular data.

## 1. Profile before analyzing
Load with pandas (`read_csv` with explicit `dtype` and `parse_dates`), then report shape, dtypes, null counts, and duplicates. Check date ranges and categorical cardinality. Never aggregate before knowing what is missing — nulls silently become wrong answers.

## 2. Clean with a record, not by hand
Fix types, strip whitespace, normalize case on keys, parse timezones to UTC, and drop or flag exact duplicates. Keep every cleaning step in the script (never hand-edit the source file) so the analysis reruns from raw data with one command.

## 3. Aggregate in the right grain
Group by the question's unit (per user, per day, per cohort — not per row). Prefer medians over means for skewed money/latency data. Always show N alongside every aggregate; a 5-star average from 2 reviews is noise, not insight.

## 4. Visualize the top finding only
One chart per question, with labeled axes and the takeaway in the title (`Median latency fell 40% after the deploy`, not `Latency over time`). Use the `notebook` tool for `.ipynb` work so cells stay re-runnable; save PNGs next to the script, never pasted blobs.

## 5. Pitfalls that produce confident wrong answers
- Mixing timezones or date formats across sources — normalize to UTC on load.
- Joining on dirty keys (trailing spaces, case drift) — normalize before merging.
- Survivorship bias: the data only shows what was recorded — state what is NOT in the data.
- Encoding surprises (BOM, latin-1) — open with `encoding='utf-8-sig'` first, fall back deliberately.

## 6. Verify with a second cut
Recompute the headline number a different way (different groupby, a spot-check of 5 raw rows, or totals that must reconcile). Write findings as: question, method (one line), number, caveat. If two cuts disagree, say so — a flagged conflict beats a smooth lie.
