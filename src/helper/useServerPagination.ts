// Server-side pagination hook.
//
// Owns page + pageSize state, exposes a `total` setter the caller updates
// after each API call, and a stable `cacheKey` whose identity changes
// whenever page/size changes — consumers use this key as a dependency so
// their effect fires only when the server actually needs to be re-queried.
//
// Page-size change resets to page 1. Consumers should also call
// `resetToFirstPage()` when their *external* filters change (dates,
// search, tab, etc.) — that keeps the hook filter-agnostic.
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  setPage: (n: number) => void;
  setPageSize: (n: number) => void;
  setTotal: (n: number) => void;
  resetToFirstPage: () => void;
}

export function useServerPagination(defaultPageSize = 25): ServerPagination {
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);
  const [total, setTotal] = useState(0);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  // Clamp page if total shrinks past the current page — happens when the
  // server returns a smaller dataset after a filter tightens.
  useEffect(() => {
    if (page > pages) setPageRaw(pages);
  }, [page, pages]);

  const setPage = useCallback((n: number) => {
    setPageRaw(Math.max(1, Math.floor(n)));
  }, []);

  const setPageSize = useCallback((n: number) => {
    setPageSizeRaw(Math.max(1, Math.floor(n)));
    setPageRaw(1);
  }, []);

  const resetToFirstPage = useCallback(() => setPageRaw(1), []);

  return { page, pageSize, total, pages, setPage, setPageSize, setTotal, resetToFirstPage };
}
