---
name: jupyter-notebooks
description: Jupyter notebooks for reproducible analysis: linear flow, pinned envs, no hidden state. Use when asked for notebooks, data analysis, or ipynb work.
---

# Jupyter Notebook Procedure

## 1. Linear top-to-bottom execution, always
- Restart kernel + Run All before committing or sharing. A notebook that only works via out-of-order execution is broken — hidden state will betray the next reader.
- One narrative per notebook (question → data → method → answer). A notebook doing five things needs splitting.

## 2. Pin the environment
- `requirements.txt` / `environment.yml` with pinned versions committed next to the notebook. "Works on my laptop" notebooks rot in weeks.
- Seed every RNG (`random.seed`, `np.random.seed`, torch manual seed) at the top; note the seed in the markdown.

## 3. Small cells, markdown between
- Each code cell does one thing with a markdown cell above saying why. A 200-line cell is a script pretending to be analysis.
- Keep outputs small: `.head()`, sampled plots, aggregated tables. A 50MB output blob in git is a mess — clear outputs before committing (`nbstripout` pre-commit hook).

## 4. Promote working code out
- Logic used twice becomes a `.py` module imported by the notebook, tested by the repo suite. Notebooks explore; modules ship.
- Parameterize with papermill/jupyter-book for reruns, never copy-paste the notebook per dataset.

## Pitfalls
- Credentials in cells (API keys, tokens) get committed — use env vars + `.env`, and scrub with `nbstripout` before every commit.
- Matplotlib inline figures at full resolution bloat the file — set modest `dpi`/`figsize` defaults.
