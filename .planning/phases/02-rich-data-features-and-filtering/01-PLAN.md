---
wave: 1
depends_on: []
files_modified:
  - components/common/DateRangePicker.tsx
  - components/dashboards/shared/AnalyticsDashboard.tsx
autonomous: true
requirements: []
---

# Plan 01: Global Date Filtering and Interactive Drill-Downs

<objective>
To implement a robust date range filtering UI and add direct drill-down interactions to all dashboard charts so that clicking data points intelligently filters the global dashboard context.
</objective>

<task>
<description>
Create a Date Range Picker component hooked to FilterContext.
</description>
<read_first>
- contexts/FilterContext.tsx
</read_first>
<action>
Create `components/common/DateRangePicker.tsx` that uses native `<input type="date" />` elements.
Requirements:
1. Use `useFilter()` from `contexts/FilterContext.tsx`.
2. Render two date inputs: one for `startDate` and one for `endDate`.
3. When inputs change, trigger `setFilter('startDate', value)` and `setFilter('endDate', value)`.
4. Style them compactly using standard Tailwind forms/inputs (e.g., `bg-transparent border border-border rounded-md px-3 py-1.5 text-sm`).
5. Include a clear/reset cross button when either date is actively set.
</action>
<acceptance_criteria>
- File `components/common/DateRangePicker.tsx` exists and exports the component.
- The component correctly reads `filters.startDate` and `filters.endDate` from Context.
- Native `input type="date"` logic successfully triggers `setFilter`.
</acceptance_criteria>
</task>

<task>
<description>
Integrate DateRangePicker into the Dashboard Header and Add Chart Drill-Down Interactions.
</description>
<read_first>
- components/dashboards/shared/AnalyticsDashboard.tsx
- contexts/FilterContext.tsx
</read_first>
<action>
Modify `components/dashboards/shared/AnalyticsDashboard.tsx`:

1. Import `DateRangePicker` and place it at the very top of the Dashboard render (e.g., inside or above `PeriodToggle`), rendering it prominently.
2. Update the internal `ChartCard` helper interface and definition to accept an optional `onEvents?: Record<string, Function>` prop.
3. Pass `onEvents={onEvents}` into the `<ECharts />` component inside `ChartCard`.
4. Create specific drill-down handlers and pass them as `onEvents` to the following charts:
   - For `customersChartRef` (Top Customers): `onEvents={{ click: (p: any) => filters.companyName?.includes(p.name) ? setFilter('companyName', []) : setFilter('companyName', [p.name]) }}`
   - For `brandChartRef` (Sales by Brand): `onEvents={{ click: (p: any) => filters.brand1?.includes(p.name) ? setFilter('brand1', []) : setFilter('brand1', [p.name]) }}`
   - For `pipelineChartRef` (Pipeline Status): `onEvents={{ click: (p: any) => filters.status?.includes(p.name) ? setFilter('status', []) : setFilter('status', [p.name]) }}`
</action>
<acceptance_criteria>
- `AnalyticsDashboard.tsx` successfully renders `<DateRangePicker />`.
- `ChartCard` internally accepts and passes an `onEvents` prop.
- The Top Customers, Brand, and Pipeline charts correctly have `onEvents` configured to toggle their respective contextual filters.
</acceptance_criteria>
</task>

<must_haves>
- The DateRangePicker works smoothly for selecting start and end bounds without validation errors.
- Clicking on a specific Brand in the pie chart successfully filters the entire dashboard context.
</must_haves>

<verification>
1. Check that `DateRangePicker.tsx` was correctly written.
2. Verify that `AnalyticsDashboard.tsx` has been appropriately modified to support drill-downs.
</verification>
