'use client';

import { useDebounce } from 'use-debounce';

/**
 * Debounced mirror of a fast-changing value — in practice, search boxes.
 *
 * 26 dashboards filtered their full dataset synchronously inside a `useMemo`
 * keyed on the raw input value, so every keystroke re-scanned every row of
 * Pricelist / Inventory / Accounting. `use-debounce` was already a declared
 * dependency but had never been imported anywhere.
 *
 * Usage — keep the raw value bound to the input so typing stays responsive,
 * and filter on the debounced one:
 *
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebouncedValue(search);
 *   const rows = useMemo(() => filter(data, debouncedSearch), [data, debouncedSearch]);
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
    const [debounced] = useDebounce(value, delayMs);
    return debounced;
}

export default useDebouncedValue;
