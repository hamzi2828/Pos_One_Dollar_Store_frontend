'use client';

// Category name -> its tags (other names, e.g. "Cleaning & Bath" -> Tissue, Towel).
// For dropdowns that only get category names (reports, filters, datalists): put
// `data-keywords={keywordsFor(name)}` on the <option> and SearchSelect finds the
// category by its tags too. Loaded once and shared by every page (1 min cache).
import { useCallback, useEffect, useState } from 'react';
import { categoryService, tagKeywords } from '@/app/(routes)/admin/products/services/categoryService';

type TagMap = Record<string, string[]>; // lower-case name -> tags

const TTL = 60_000;
let cache: { at: number; promise: Promise<TagMap> } | null = null;

function loadTags(): Promise<TagMap> {
  if (cache && Date.now() - cache.at < TTL) return cache.promise;
  const promise = categoryService
    .listCategories()
    .then((list) => {
      const map: TagMap = {};
      for (const c of list) if (c.tags.length) map[c.name.trim().toLowerCase()] = c.tags;
      return map;
    })
    .catch(() => {
      cache = null; // try again next time
      return {} as TagMap;
    });
  cache = { at: Date.now(), promise };
  return promise;
}

/** Drop the cached tags (after a category's tags are edited). */
export function clearCategoryTagsCache() {
  cache = null;
}

export function useCategoryTags(enabled = true) {
  const [map, setMap] = useState<TagMap>({});
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadTags().then((m) => live && setMap(m));
    return () => {
      live = false;
    };
  }, [enabled]);

  const tagsFor = useCallback((name?: string | null): string[] => map[(name || '').trim().toLowerCase()] || [], [map]);
  const keywordsFor = useCallback((name?: string | null): string => tagKeywords(tagsFor(name)), [tagsFor]);
  return { tagsFor, keywordsFor };
}
