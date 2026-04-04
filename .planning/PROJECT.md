# Project: CRM Dashboard Chart Enhancements

## Core Value
Standardize and enhance the ECharts dashboard components to guarantee a consistent, responsive, and polished layout for the users.

## Context
### What This Is
This project aims to refactor and unify the layout and loading behaviors of the analytics charts on the CRM dashboard (e.g., `MonthlyWinValueChart`, `ProjectOutcomeChart`, `WinRateChart`). The current charts lack uniformity in screen response, sizing, and loading states. By introducing strict layout consistency and loading skeletons, the dashboard will feel seamlessly integrated.

### Why This Matters for the User
A consistent layout builds trust and looks professional. Users won't experience jarring jumps or misaligned data visualizations, especially on varying screen sizes or during initial data loads.

## Requirements

### Validated
- ✓ Next.js App Router architecture and structure — existing
- ✓ Supabase integration for backend operations — existing
- ✓ ECharts implementation via `echarts-for-react` — existing
- ✓ Component tree containing `MonthlyWinValueChart`, `ProjectOutcomeChart`, `ProjectsByBrandChart`, `TopCustomersChart`, `WinRateChart` — existing

### Active
- [ ] Enforce identical, strict heights for all CRM dashboard charts.
- [ ] Implement robust loading skeletons that match the chart footprint before data is ready.
- [ ] Improve responsiveness of charts across different dashboard layout breakpoint bounds.
- [ ] Refactor chart layout wrappers to reduce UI boilerplate where applicable.
- [ ] Add new advanced data filters, such as comprehensive date ranges.
- [ ] Provide chart drill-down capabilities for granular insights.
- [ ] Embed richer custom tooltips to enhance hovering user experience. (Phase 3)
- [ ] Implement PDF and Excel data export for chart datasets. (Phase 4)
- [ ] Add extended visualizations (e.g., trend lines, goal targets) to existing charts. (Phase 4)

### Out of Scope
- [ ] Adding new major data visualizations (focusing purely on standardizing existing charts).
- [ ] Changing the underlying data querying endpoints (unless strictly necessary to support skeletons).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus purely on layout and consistency | Visual polish is best achieved by unifying constraints before adding new features. | — Pending |

## Evolution
This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 after initialization*
