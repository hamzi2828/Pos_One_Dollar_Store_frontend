"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { colorService, mapColor } from "../services/colorService";
import { sizeService, mapSize } from "../services/sizeService";

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

type Color = ReturnType<typeof mapColor>;
type Size = ReturnType<typeof mapSize>;

// Attribute tabs — add new entries here to extend (e.g., Material, Brand, etc.)
type AttributeTab = { key: string; label: string };
const attributeTabs: AttributeTab[] = [
  { key: "colors", label: "Colors" },
  { key: "sizes", label: "Sizes" },
];

export default function ColorsSizesTab() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial tab from URL (?tab=colors|sizes), default to "colors"
  const urlTab = searchParams.get("tab");
  const initialTab = attributeTabs.some((t) => t.key === urlTab) ? urlTab! : "colors";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Keep state in sync if user navigates with back/forward or external link
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && attributeTabs.some((x) => x.key === t) && t !== activeTab) {
      setActiveTab(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Update URL when tab changes (shallow, no scroll)
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newColor, setNewColor] = useState<{ name: string; hex: string; active: boolean }>({ name: "", hex: "", active: true });
  const [newSize, setNewSize] = useState<{ name: string; active: boolean }>({ name: "", active: true });
  // Edit states
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [colorDraft, setColorDraft] = useState<{ name: string; hex: string }>({ name: "", hex: "" });
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null);
  const [sizeDraft, setSizeDraft] = useState<{ name: string }>({ name: "" });
  const [saving, setSaving] = useState(false);
  // One attribute request at a time. The ref is the synchronous double-click lock,
  // busyKey says which button shows the spinner (e.g. "create-color", "delete-size:<id>").
  const busyRef = useRef<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const anyBusy = busyKey !== null;
  const runLocked = async (key: string, fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = key;
    setBusyKey(key);
    try {
      await fn();
    } finally {
      busyRef.current = null;
      setBusyKey(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [c, s] = await Promise.all([colorService.listColors(), sizeService.listSizes()]);
        if (!mounted) return;
        setColors(c);
        setSizes(s);
      } catch (e) {
        console.error("Failed to load colors/sizes", e);
        if (mounted) setError("Failed to load colors/sizes");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const activeColorCount = useMemo(() => colors.filter(c => c.active).length, [colors]);
  const activeSizeCount = useMemo(() => sizes.filter(s => s.active).length, [sizes]);

  const handleCreateColor = async () => {
    const name = newColor.name.trim();
    if (!name) return;
    const slug = slugify(name);
    await runLocked("create-color", async () => {
      try {
        const created = await colorService.createColor({ name, slug, hex: newColor.hex || "", active: newColor.active });
        setColors(prev => [created, ...prev]);
        setNewColor({ name: "", hex: "", active: true });
      } catch (e) {
        console.error("Failed to create color", e);
        alert("Failed to create color");
      }
    });
  };

  // Edit: Color
  const startEditColor = (c: Color) => {
    setEditingColorId(c.id);
    setColorDraft({ name: c.name, hex: c.hex || "" });
  };

  const cancelEditColor = () => {
    setEditingColorId(null);
  };

  const saveEditColor = async () => {
    if (!editingColorId) return;
    const name = colorDraft.name.trim();
    if (!name) return;
    await runLocked(`edit-color:${editingColorId}`, async () => {
      try {
        setSaving(true);
        const updated = await colorService.updateColor(editingColorId, {
          name,
          slug: slugify(name),
          hex: colorDraft.hex || "",
        });
        setColors((prev) => prev.map((c) => (c.id === editingColorId ? updated : c)));
        setEditingColorId(null);
      } catch (e) {
        console.error("Failed to update color", e);
        alert("Failed to update color");
      } finally {
        setSaving(false);
      }
    });
  };

  // Edit: Size
  const startEditSize = (s: Size) => {
    setEditingSizeId(s.id);
    setSizeDraft({ name: s.name });
  };

  const cancelEditSize = () => {
    setEditingSizeId(null);
  };

  const saveEditSize = async () => {
    if (!editingSizeId) return;
    const name = sizeDraft.name.trim();
    if (!name) return;
    await runLocked(`edit-size:${editingSizeId}`, async () => {
      try {
        setSaving(true);
        const updated = await sizeService.updateSize(editingSizeId, {
          name,
          slug: slugify(name),
        });
        setSizes((prev) => prev.map((s) => (s.id === editingSizeId ? updated : s)));
        setEditingSizeId(null);
      } catch (e) {
        console.error("Failed to update size", e);
        alert("Failed to update size");
      } finally {
        setSaving(false);
      }
    });
  };

  const handleCreateSize = async () => {
    const name = newSize.name.trim();
    if (!name) return;
    const slug = slugify(name);
    await runLocked("create-size", async () => {
      try {
        const created = await sizeService.createSize({ name, slug, active: newSize.active });
        setSizes(prev => [created, ...prev]);
        setNewSize({ name: "", active: true });
      } catch (e) {
        console.error("Failed to create size", e);
        alert("Failed to create size");
      }
    });
  };

  const toggleColor = (id: string, next: boolean) =>
    runLocked(`toggle-color:${id}`, async () => {
      const prev = colors;
      setColors(p => p.map(c => c.id === id ? { ...c, active: next } : c));
      try { await colorService.setActive(id, next); } catch (e) {
        console.error("Failed to update color", e);
        setColors(prev);
        alert("Failed to update color");
      }
    });

  const toggleSize = (id: string, next: boolean) =>
    runLocked(`toggle-size:${id}`, async () => {
      const prev = sizes;
      setSizes(p => p.map(s => s.id === id ? { ...s, active: next } : s));
      try { await sizeService.setActive(id, next); } catch (e) {
        console.error("Failed to update size", e);
        setSizes(prev);
        alert("Failed to update size");
      }
    });

  const deleteColor = (id: string) =>
    runLocked(`delete-color:${id}`, async () => {
      const prev = colors;
      setColors(p => p.filter(c => c.id !== id));
      try { await colorService.deleteColor(id); } catch (e) {
        console.error("Failed to delete color", e);
        setColors(prev);
        alert("Failed to delete color");
      }
    });

  const deleteSize = (id: string) =>
    runLocked(`delete-size:${id}`, async () => {
      const prev = sizes;
      setSizes(p => p.filter(s => s.id !== id));
      try { await sizeService.deleteSize(id); } catch (e) {
        console.error("Failed to delete size", e);
        setSizes(prev);
        alert("Failed to delete size");
      }
    });

  return (
    <div className="space-y-2 sm:space-y-3 md:space-y-4">
      {/* Attribute tabs */}
      <div className="bg-white shadow sm:rounded-lg">
        <nav className="flex -mb-px overflow-x-auto" aria-label="Attribute tabs">
          {attributeTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={
                  "flex-1 min-w-[100px] sm:min-w-[140px] py-2.5 sm:py-3 md:py-4 px-3 sm:px-4 md:px-6 text-center border-b-2 font-medium text-xs sm:text-sm focus:outline-none transition-colors " +
                  (isActive
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300")
                }
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Colors panel */}
      {activeTab === "colors" && (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Colors</h3>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">Active: {activeColorCount} / {colors.length}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newColor.name}
              onChange={(e) => setNewColor(p => ({ ...p, name: e.target.value }))}
              placeholder="Color name"
              className="h-9 w-44 rounded-lg border border-gray-300 px-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={newColor.hex}
              onChange={(e) => setNewColor(p => ({ ...p, hex: e.target.value }))}
              placeholder="#HEX (optional)"
              className="h-9 w-40 rounded-lg border border-gray-300 px-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <button
              type="button"
              aria-pressed={newColor.active}
              onClick={() => setNewColor(p => ({ ...p, active: !p.active }))}
              className={`inline-flex items-center justify-center h-8 rounded-full px-2 text-sm transition ${newColor.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow`}></span>
            </button>
            <button
              type="button"
              onClick={handleCreateColor}
              disabled={anyBusy}
              aria-busy={busyKey === "create-color"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busyKey === "create-color" ? (<><Loader2 className="h-4 w-4 animate-spin" />Adding…</>) : "Add Color"}
            </button>
          </div>

          <div className="mt-4 divide-y divide-gray-100 border rounded-lg">
            {loading ? (
              <div className="p-3 text-sm text-gray-500">Loading…</div>
            ) : error ? (
              <div className="p-3 text-sm text-red-600">{error}</div>
            ) : colors.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No colors yet.</div>
            ) : (
              colors.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-white">
                  {editingColorId === c.id ? (
                    <>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={colorDraft.name}
                          onChange={(e) => setColorDraft((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Name"
                          className="h-9 w-44 rounded-lg border border-gray-300 px-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          value={colorDraft.hex}
                          onChange={(e) => setColorDraft((p) => ({ ...p, hex: e.target.value }))}
                          placeholder="#HEX"
                          className="h-9 w-32 rounded-lg border border-gray-300 px-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={saveEditColor} disabled={saving || anyBusy} aria-busy={saving} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed">
                          {saving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>) : "Save"}
                        </button>
                        <button type="button" onClick={cancelEditColor} disabled={saving} className="text-sm text-gray-600 hover:text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed">Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        {c.hex ? <span className="h-4 w-4 rounded border" style={{ backgroundColor: c.hex }} /> : null}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-500">{c.slug}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-pressed={c.active}
                          onClick={() => toggleColor(c.id, !c.active)}
                          disabled={anyBusy}
                          aria-busy={busyKey === `toggle-color:${c.id}`}
                          className={`inline-flex items-center justify-center h-8 rounded-full px-2 text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${c.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {busyKey === `toggle-color:${c.id}` ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow"><Loader2 className="h-3.5 w-3.5 animate-spin" /></span>
                          ) : (
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow`}></span>
                          )}
                        </button>
                        <button type="button" className="text-sm text-gray-600 hover:text-gray-700" onClick={() => startEditColor(c)}>Edit</button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => deleteColor(c.id)}
                          disabled={anyBusy}
                          aria-busy={busyKey === `delete-color:${c.id}`}
                        >
                          {busyKey === `delete-color:${c.id}` ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Deleting…</>) : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}

      {/* Sizes panel */}
      {activeTab === "sizes" && (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">Sizes</h3>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">Active: {activeSizeCount} / {sizes.length}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newSize.name}
              onChange={(e) => setNewSize(p => ({ ...p, name: e.target.value }))}
              placeholder="Size label (e.g., XS)"
              className="h-9 w-44 rounded-lg border border-gray-300 px-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <button
              type="button"
              aria-pressed={newSize.active}
              onClick={() => setNewSize(p => ({ ...p, active: !p.active }))}
              className={`inline-flex items-center justify-center h-8 rounded-full px-2 text-sm transition ${newSize.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow`}></span>
            </button>
            <button
              type="button"
              onClick={handleCreateSize}
              disabled={anyBusy}
              aria-busy={busyKey === "create-size"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busyKey === "create-size" ? (<><Loader2 className="h-4 w-4 animate-spin" />Adding…</>) : "Add Size"}
            </button>
          </div>

          <div className="mt-4 divide-y divide-gray-100 border rounded-lg">
            {loading ? (
              <div className="p-3 text-sm text-gray-500">Loading…</div>
            ) : error ? (
              <div className="p-3 text-sm text-red-600">{error}</div>
            ) : sizes.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No sizes yet.</div>
            ) : (
              sizes.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-white">
                  {editingSizeId === s.id ? (
                    <>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={sizeDraft.name}
                          onChange={(e) => setSizeDraft({ name: e.target.value })}
                          placeholder="Name"
                          className="h-9 w-44 rounded-lg border border-gray-300 px-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={saveEditSize} disabled={saving || anyBusy} aria-busy={saving} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed">
                          {saving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>) : "Save"}
                        </button>
                        <button type="button" onClick={cancelEditSize} disabled={saving} className="text-sm text-gray-600 hover:text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed">Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.slug}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-pressed={s.active}
                          onClick={() => toggleSize(s.id, !s.active)}
                          disabled={anyBusy}
                          aria-busy={busyKey === `toggle-size:${s.id}`}
                          className={`inline-flex items-center justify-center h-8 rounded-full px-2 text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {busyKey === `toggle-size:${s.id}` ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow"><Loader2 className="h-3.5 w-3.5 animate-spin" /></span>
                          ) : (
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow`}></span>
                          )}
                        </button>
                        <button type="button" className="text-sm text-gray-600 hover:text-gray-700" onClick={() => startEditSize(s)}>Edit</button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => deleteSize(s.id)}
                          disabled={anyBusy}
                          aria-busy={busyKey === `delete-size:${s.id}`}
                        >
                          {busyKey === `delete-size:${s.id}` ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Deleting…</>) : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
