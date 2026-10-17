'use client';

import { useEffect, useMemo, useState } from 'react';
import { labelService, summarizeCodes, hasCodeFields, type CodeSummary, type LooseProduct } from '../../services/labelService';

/**
 * Short code / box size / batches summary per product id, for list badges.
 * Reads the fields straight from the products when they carry them; otherwise
 * (older productService mapping drops them) loads the raw list once.
 */
export function useCodeSummaries(products: LooseProduct[]): Record<string, CodeSummary> {
  const direct = useMemo(() => products.length > 0 && products.some(hasCodeFields), [products]);
  const [fetched, setFetched] = useState<Record<string, CodeSummary>>({});

  useEffect(() => {
    if (direct || products.length === 0) return;
    let alive = true;
    labelService
      .listRawProducts()
      .then((raw) => {
        if (!alive) return;
        const map: Record<string, CodeSummary> = {};
        for (const p of raw) {
          const id = String(p._id ?? p.id ?? '');
          if (id) map[id] = summarizeCodes(p);
        }
        setFetched(map);
      })
      .catch(() => {
        /* badges are optional */
      });
    return () => {
      alive = false;
    };
  }, [direct, products]);

  return useMemo(() => {
    if (!direct) return fetched;
    const map: Record<string, CodeSummary> = {};
    for (const p of products) {
      const id = String(p.id ?? p._id ?? '');
      if (id) map[id] = summarizeCodes(p);
    }
    return map;
  }, [direct, products, fetched]);
}
