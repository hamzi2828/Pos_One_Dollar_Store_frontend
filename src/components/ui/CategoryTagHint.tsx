// Category search by name OR tags (other names, e.g. typing "Tissue" finds
// "Cleaning & Bath"), for the custom category pickers that are not a SearchSelect.

type Tagged = { name: string; tags?: string[] | null };

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const wordsOf = (q: string) => fold(q).split(/\s+/).filter(Boolean);

/** Every typed word must appear in the name or one of the tags. */
export function categoryMatches(c: Tagged, query: string): boolean {
  const words = wordsOf(query);
  if (!words.length) return true;
  const text = [c.name, ...(c.tags || [])].map(fold).join('\n');
  return words.every((w) => text.includes(w));
}

export function filterCategoriesByQuery<T extends Tagged>(list: T[], query: string): T[] {
  return wordsOf(query).length ? list.filter((c) => categoryMatches(c, query)) : list;
}

/** The tags that matched words the name itself does not have. */
export function matchedTags(c: Tagged, query: string): string[] {
  const words = wordsOf(query);
  if (!words.length || !c.tags?.length) return [];
  const name = fold(c.name);
  const missing = words.filter((w) => !name.includes(w));
  if (!missing.length) return [];
  return c.tags.filter((t) => missing.some((w) => fold(t).includes(w)));
}

/** Small grey "also: Tissue" under a category found through its tags. */
export function TagHint({ category, query }: { category: Tagged; query: string }) {
  const hits = matchedTags(category, query);
  if (!hits.length) return null;
  return <span className="block text-xs font-normal text-gray-400">also: {hits.join(', ')}</span>;
}
