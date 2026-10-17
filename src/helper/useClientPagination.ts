// Tiny client-side pagination hook. Given an array of items, returns the
// current slice + handlers for changing page / page size. Resets to page 1
// when the source array changes identity OR when filters change upstream.
//
// Usage:
//   const items = useMemo(() => filter(data), [data, query]);
//   const pg = useClientPagination(items, 25);
//   {pg.paged.map(...)}
//   <TablePagination page={pg.page} pages={pg.pages} total={pg.total}
//     limit={pg.pageSize} onPageChange={pg.setPage} onLimitChange={pg.setPageSize} />
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface ClientPagination<T> {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  paged: T[];
  setPage: (n: number) => void;
  setPageSize: (n: number) => void;
}

export function useClientPagination<T>(items: T[], defaultPageSize = 25): ClientPagination<T> {
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  // Auto-clamp page into range when the source array shrinks (e.g. after a
  // filter change) so the table never renders an empty slice past the end.
  useEffect(() => {
    if (page > pages) setPageRaw(pages);
    if (page < 1) setPageRaw(1);
  }, [page, pages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const setPage = useCallback(
    (n: number) => setPageRaw(Math.max(1, Math.min(pages, Math.floor(n)))),
    [pages],
  );
  const setPageSize = useCallback((n: number) => {
    setPageSizeRaw(Math.max(1, Math.floor(n)));
    setPageRaw(1);
  }, []);

  return { page, pageSize, total, pages, paged, setPage, setPageSize };
}
