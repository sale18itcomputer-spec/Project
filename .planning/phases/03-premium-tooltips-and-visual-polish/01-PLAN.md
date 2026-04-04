---
wave: 1
depends_on: []
files_modified:
  - components/charts/MonthlyWinValueChart.tsx
  - components/charts/ProjectOutcomeChart.tsx
  - components/charts/ProjectsByBrandChart.tsx
  - components/charts/TopCustomersChart.tsx
  - components/charts/WinRateChart.tsx
  - components/dashboards/shared/AnalyticsDashboard.tsx
autonomous: true
requirements: []
---

# Plan 01: Premium Custom Tooltips and Visual Polish

<objective>
To enrich every chart dashboard with premium, data-dense tooltips written in refined HTML, and to standardize animation behaviors for a consistent, high-end visual experience.
</objective>

<task>
<description>
Polish Tooltips and Animations in standalone chart components.
</description>
<read_first>
- components/charts/MonthlyWinValueChart.tsx
- components/charts/ProjectOutcomeChart.tsx
- components/charts/ProjectsByBrandChart.tsx
- components/charts/TopCustomersChart.tsx
- components/charts/WinRateChart.tsx
</read_first>
<action>
Modify the `option` or `useMemo` blocks in all 5 specific chart components:
1. **TOOLTIP FORMATTING**: Use standard Rich HTML structure (flexboxes, bolding, opacity for subtitles).
   - Ensure `borderRadius: 12`, `padding: [12, 16]`, and `shadowBlur: 10` are on all tooltips.
2. **ANIMATION**: Add the following to the top-level of all `option` objects:
   - `animationDuration: 1000`
   - `animationEasing: 'cubicOut'`
   - `animationThreshold: 2000`
3. **COMPLETENESS**: 
   - Ensure the `ProjectOutcomeChart` (Pipeline Status) and `ProjectsByBrandChart` also show the exact primary metric (Count or Currency) and their percentage of the total in the tooltip.
</action>
<acceptance_criteria>
- All 5 charts in `components/charts/` show enriched tooltips with consistent styling.
- All 5 charts utilize `cubicOut` easing animations.
</acceptance_criteria>
</task>

<task>
<description>
Update Tooltips for Dashboard Inline Options in AnalyticsDashboard.
</description>
<read_first>
- components/dashboards/shared/AnalyticsDashboard.tsx
</read_first>
<action>
Update `revenueOption`, `customerOption`, `pipelineOption`, and `brandOption` inside the `AnalyticsDashboard.tsx` component:
1. **REVENUE GROWTH**: Update `tooltip.formatter` to show the full period name and currency value with a cleaner bold layout.
2. **TOP CUSTOMERS**: Update horizontal bar tooltip to display both the currency total and a "Top Contributor" subtitle if possible (even if placeholder logic for now).
3. **BRAND PIE**: Ensure the pie chart tooltip properly displays the color dot matching the brand, the currency value bolded, and the % share in a chip.
4. **PIPELINE STATUS**: Refine the tooltip to show "Deal Count" in a more readable bold text.
</action>
<acceptance_criteria>
- `AnalyticsDashboard.tsx` contains modernized tooltip formatters for all 4 inline charts.
- Layouts use `gap-24` and `font-weight: 800` for primary metrics as seen in existing premium examples.
</acceptance_criteria>
</task>

<must_haves>
- Custom tooltips across the whole dashboard must have perfectly matching rounded corners (12px) and padding (12px 16px).
- Animations must feel distinctly smoother due to the standardized cubicOut easing.
</must_haves>

<verification>
1. Check that `AnalyticsDashboard.tsx` tooltips now have standardized layout CSS.
2. Verify that `WinRateChart.tsx` or `MonthlyWinValueChart.tsx` has correctly added animation control fields.
</verification>
