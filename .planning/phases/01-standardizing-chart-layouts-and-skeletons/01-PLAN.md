---
wave: 1
depends_on: []
files_modified:
  - components/ui/skeleton.tsx
  - components/charts/ChartSkeleton.tsx
  - components/charts/MonthlyWinValueChart.tsx
  - components/charts/ProjectOutcomeChart.tsx
  - components/charts/ProjectsByBrandChart.tsx
  - components/charts/TopCustomersChart.tsx
  - components/charts/WinRateChart.tsx
autonomous: true
requirements: []
---

# Plan 01: Standardize Chart Layouts and Introduce Skeletons

<objective>
To ensure all CRM dashboard ECharts have a uniform, responsive layout with identical heights, while providing robust loading skeletons before the component's data is fully hydrated or loaded.
</objective>

<task>
<description>
Create standard Skeleton loading primitives `skeleton.tsx` and a tailored `ChartSkeleton.tsx` for visual layout feedback during loading phases.
</description>
<read_first>
- tailwind.config.ts (if any exist) or globals.css
</read_first>
<action>
1. Create `components/ui/skeleton.tsx` with the following implementation:
```tsx
import { cn } from "../../lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

2. Create `components/charts/ChartSkeleton.tsx`:
A card component that mimics the padding and structure of the standard charts but incorporates `Skeleton` lines where the titles are, and a large skeleton block for the grid space graph area.
Specifically, it must have standard responsive classes: `className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden h-[400px] lg:h-[500px] w-full"`
The internals should be:
- Header: Two pulsing skeletons, one small (subtitle) and one large (title).
- Graph Area: Large skeleton block spanning remaining flexible space.
</action>
<acceptance_criteria>
- `components/ui/skeleton.tsx` exports the `Skeleton` functional component.
- `components/charts/ChartSkeleton.tsx` exports `ChartSkeleton` and implements `h-[400px] lg:h-[500px]`.
</acceptance_criteria>
</task>

<task>
<description>
Standardize Heights and Responsiveness across all 5 chart components.
</description>
<read_first>
- components/charts/MonthlyWinValueChart.tsx
- components/charts/ProjectOutcomeChart.tsx
- components/charts/ProjectsByBrandChart.tsx
- components/charts/TopCustomersChart.tsx
- components/charts/WinRateChart.tsx
</read_first>
<action>
Modify all 5 chart components to remove all custom inline height rules (like `style={{ height: '900px' }}` or any tailwind heights like `h-64/h-96`) from their outermost wrapper elements.

Replace these wrappers with consistent, responsive tailwind height classes across the board. The new wrapper classes MUST be:
`className="bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden h-[400px] lg:h-[500px] w-full"`

The 5 components to refactor:
- `components/charts/MonthlyWinValueChart.tsx`
- `components/charts/ProjectOutcomeChart.tsx`
- `components/charts/ProjectsByBrandChart.tsx`
- `components/charts/TopCustomersChart.tsx`
- `components/charts/WinRateChart.tsx`
</action>
<acceptance_criteria>
- `components/charts/MonthlyWinValueChart.tsx` contains `h-[400px] lg:h-[500px]` and no longer has `style={{ height: '900px' }}`.
- `components/charts/ProjectOutcomeChart.tsx` contains `h-[400px] lg:h-[500px]`.
- `components/charts/ProjectsByBrandChart.tsx` contains `h-[400px] lg:h-[500px]`.
- `components/charts/TopCustomersChart.tsx` contains `h-[400px] lg:h-[500px]`.
- `components/charts/WinRateChart.tsx` contains `h-[400px] lg:h-[500px]`.
</acceptance_criteria>
</task>

<must_haves>
- Skeletons correctly built to animate while loading.
- Every specific chart component file explicitly has the standardized height constraint class.
</must_haves>

<verification>
1. Running `grep -r "h-\[400px\] lg:h-\[500px\]" components/charts/` returns all 5 chart components and the wrapper skeleton.
2. `Skeleton` component correctly exports and resolves locally inside `ChartSkeleton`.
</verification>
