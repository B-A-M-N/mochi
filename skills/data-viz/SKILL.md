---
name: data-viz
description: Design and build data visualizations — chart type selection, perceptual accuracy, axis integrity, color scales, and library choices (D3/Recharts/Plotly/Observable). Use when asked to chart, graph, or visualize data, or when reviewing a chart for honesty and clarity.
---

# Data Visualization Procedure

A chart is an argument. Every element either sharpens the argument or lies about it.

## 1. Pick the encoding by the QUESTION (not the data shape)
- Comparison of categories -> bar (sorted by value, not alphabetically, unless order IS the point).
- Trend over time -> line (time on x, zero-baseline only if differences matter absolutely).
- Part-to-whole -> stacked bar ONLY if totals matter; pie if and only if <=5 slices AND the slices are obviously different sizes (the pie is almost never right).
- Distribution -> histogram/box/violin by sample size; scatter for relationship; heatmap for two-categorical density.
- Flow/change -> Sankey for flow, slope chart for two-period comparison, waterfall for composition of a delta.

## 2. Perceptual honesty (the integrity rules)
- Bar charts start at zero — bars encode LENGTH, and a truncated axis lies. Line charts may truncate (position encoding, not length).
- Y-axis ticks: max 5-6, round numbers, consistent intervals. Never dual axes without direct labeling of both series.
- Sort by the value being argued, highlight the argued-for element (accent color), mute the rest — attention follows color.
- Bin sizes for histograms chosen to reveal the shape, not hide it (try sqrt(n) bins as a start).

## 3. Color scales (by data type)
- Sequential data (ordered magnitude) -> single-hue ramp (light->dark). Diverging data (around a meaningful midpoint) -> two-hue ramp anchored at the midpoint.
- Categorical -> maximally distinguishable palette; >8 categories means aggregate or small-multiples, not 12 colors.
- Color-blind safety: viridis-class ramps for sequential; never red/green pairs alone. Redundant encoding (shape/label) for the critical distinction.

## 4. Library choice by job
- Quick dashboards: Recharts/Plotly Express (hours, not days). Custom interactive/editorial: D3 (you own the DOM). Static/publication: matplotlib/ggplot with a theme.
- Observable notebooks for exploratory work; export the final chart as a component when it graduates to product.
- Canvas for >10k points (with LOD sampling); SVG under that. Zoom/pan for dense time series, but default the window to the interesting range.

## 5. Polish pass (where trust is won)
- Direct labeling beats legends when series <= 5 (label at line end). Units in the axis title, not implied. Source + date range footnoted.
- Tooltips: exact values on hover; the number in the tooltip matches the visual proportion (no rounding lies).
- Empty/zero states: "no data" is rendered honestly — a gap, not a zero line.

## 6. Verification
- The squint test: main message readable at 200px wide. The lie test: does any axis/bin/scale choice exaggerate the effect argued? Fix the scale, not the conclusion.
- Numbers re-verified against the source query — a beautiful chart of wrong numbers is worse than no chart.

## Pitfalls
- The truncated bar chart (the classic lie): if a bar chart must start at non-zero, it must not be a bar chart.
- Dual-axis charts arguing causality between two coincidentally-scaled series — the most common statistical misinformation in dashboards.
- Rainbow/jet colormaps: perceptually non-linear, color-blind hostile, and scream "we didn't think about this."
