'use client';

// Select2-style dropdown used for every dropdown in the admin panel.
//
// A drop-in for a native <select>: same props (value, onChange, className,
// disabled, id, aria-label...) and the same <option> / <optgroup> children.
// onChange gets an event whose `target.value` is the picked value, so
// `onChange={(e) => setX(e.target.value)}` keeps working as before.
//
// Opens a list with a search box (5 options or more), filters as you type,
// works with the keyboard (arrows, Enter, Esc, type to jump) and floats above
// modals and tables (rendered at the end of <body>).
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

interface Opt {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
}

export type SearchSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  /** Show the search box: 'auto' (default) = when there are 5 options or more. */
  searchable?: boolean | 'auto';
  /** Shown when the value matches no option. */
  placeholder?: string;
};

const SEARCH_FROM = 5; // options needed before the search box shows ('auto')
const LIST_MAX = 288; // px
const PAD = 8; // keep the menu this far from the screen edge
const GAP = 4; // between the field and the menu
const NATIVE_ONLY = ['multiple', 'size', 'required', 'form', 'autoComplete'];

/** Plain text of an <option>'s children. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

/** <option> / <optgroup> children (also inside fragments and .map arrays) -> list. */
function readOptions(children: ReactNode, out: Opt[] = [], group?: string): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: unknown; label?: string; disabled?: boolean; children?: ReactNode };
    if (child.type === 'option') {
      const label = textOf(props.children).trim() || String(props.label ?? '');
      const value = props.value === undefined || props.value === null ? label : String(props.value);
      out.push({ value, label, disabled: !!props.disabled, group });
    } else if (child.type === 'optgroup') {
      readOptions(props.children, out, props.label);
    } else if (child.type === Fragment) {
      readOptions(props.children, out, group);
    }
  });
  return out;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Every word typed must appear in the label (any order, any case). */
function filterOptions(options: Opt[], query: string): Opt[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return options;
  return options.filter((o) => {
    const label = fold(o.label);
    return words.every((w) => label.includes(w));
  });
}

function nextEnabled(list: Opt[], from: number, step: 1 | -1): number {
  for (let i = from; i >= 0 && i < list.length; i += step) if (!list[i].disabled) return i;
  return -1;
}

const isTouch = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export function SearchSelect({
  value,
  defaultValue,
  onChange,
  children,
  className = '',
  disabled,
  name,
  id,
  autoFocus,
  searchable = 'auto',
  placeholder,
  ...rest
}: SearchSelectProps) {
  // The rest goes on the button (aria-label, title, data-*...), minus native-only props.
  const buttonProps = Object.fromEntries(
    Object.entries(rest).filter(([k]) => !NATIVE_ONLY.includes(k))
  ) as ButtonHTMLAttributes<HTMLButtonElement>;
  const options = useMemo(() => readOptions(children), [children]);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => (defaultValue !== undefined ? String(defaultValue) : options[0]?.value ?? ''));
  const current = controlled ? (value === null ? '' : String(value)) : inner;
  const selected = options.find((o) => o.value === current);
  // Like a native select: no match shows the first option (unless a placeholder is given).
  const shownLabel = selected ? selected.label : placeholder ?? options[0]?.label ?? '';
  const withSearch = searchable === 'auto' ? options.length >= SEARCH_FROM : searchable;
  // Like a native select, the field is as wide as its longest option (when no width is set),
  // so it does not jump when the choice changes. A few hidden copies of the longest labels set it.
  const sizers = useMemo(
    () => [...options.map((o) => o.label), placeholder ?? ''].sort((x, y) => y.length - x.length).slice(0, 4),
    [options, placeholder]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const shown = useMemo(() => filterOptions(options, query), [options, query]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();

  const openMenu = (seed = '') => {
    if (disabled) return;
    const q = withSearch ? seed : '';
    const list = filterOptions(options, q);
    const at = list.findIndex((o) => o.value === current);
    setQuery(q);
    setActive(!q && at >= 0 ? at : nextEnabled(list, 0, 1));
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  };

  const choose = (o: Opt) => {
    if (o.disabled) return;
    close(true);
    if (o.value === current) return;
    if (!controlled) setInner(o.value);
    if (onChange) {
      const target = { value: o.value, name: name ?? '', id: id ?? '' };
      onChange({
        target,
        currentTarget: target,
        type: 'change',
        bubbles: true,
        preventDefault() {},
        stopPropagation() {},
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist() {},
      } as unknown as ChangeEvent<HTMLSelectElement>);
    }
  };

  const move = (step: 1 | -1, by = 1) => {
    if (!shown.length) return;
    let i = active < 0 ? (step === 1 ? -1 : shown.length) : active;
    let found = -1;
    for (let n = 0; n < by; n++) {
      const next = nextEnabled(shown, i + step, step);
      if (next < 0) break;
      found = i = next;
    }
    if (found >= 0) setActive(found);
  };

  /** Type the first letters of an option to jump to it (no search box). */
  const jump = (key: string) => {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 700 ? '' : typed.current.text) + fold(key), at: now };
    const i = options.findIndex((o) => !o.disabled && fold(o.label).startsWith(typed.current.text));
    if (i >= 0) setActive(i);
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu();
    } else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openMenu(e.key);
      if (!withSearch) jump(e.key);
    }
  };

  // Keys inside the open menu. A native listener so Esc / Enter never reach
  // window listeners (a modal that closes on Esc stays open).
  const onMenuKey = (e: KeyboardEvent) => {
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case 'Escape':
      case 'Tab':
        stop();
        close(true);
        return;
      case 'ArrowDown':
        stop();
        move(1);
        return;
      case 'ArrowUp':
        stop();
        move(-1);
        return;
      case 'PageDown':
        stop();
        move(1, 8);
        return;
      case 'PageUp':
        stop();
        move(-1, 8);
        return;
      case 'Enter': {
        stop();
        const o = shown[active];
        if (o) choose(o);
        return;
      }
      default:
        if (!withSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) jump(e.key);
    }
  };
  const menuKeyRef = useRef(onMenuKey);
  useLayoutEffect(() => {
    menuKeyRef.current = onMenuKey;
  });

  /** Put the menu under the field (or above it when there is more room there). */
  const place = useCallback(() => {
    const t = triggerRef.current;
    const m = menuRef.current;
    const l = listRef.current;
    if (!t || !m || !l) return;
    const r = t.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh || (!r.width && !r.height)) {
      setOpen(false); // the field scrolled away
      return;
    }
    const minW = Math.min(Math.max(r.width, 120), vw - PAD * 2);
    m.style.minWidth = `${minW}px`;
    m.style.maxWidth = `${Math.max(minW, Math.min(Math.max(r.width, 360), vw - PAD * 2))}px`;
    const head = m.offsetHeight - l.offsetHeight; // search box + borders
    const below = vh - r.bottom - GAP - PAD;
    const above = r.top - GAP - PAD;
    const want = Math.min(LIST_MAX, l.scrollHeight) + head;
    const up = want > below && above > below;
    l.style.maxHeight = `${Math.min(LIST_MAX, Math.max(96, (up ? above : below) - head))}px`;
    m.style.left = `${Math.max(PAD, Math.min(r.left, vw - PAD - m.offsetWidth))}px`;
    if (up) {
      m.style.top = '';
      m.style.bottom = `${vh - r.top + GAP}px`;
    } else {
      m.style.bottom = '';
      m.style.top = `${r.bottom + GAP}px`;
    }
    m.style.visibility = 'visible';
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, shown.length, place]);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    // Focus the search box (not on phones: the keyboard would cover the list).
    if (withSearch && !isTouch()) searchRef.current?.focus({ preventScroll: true });
    else menu?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => menuKeyRef.current(e);
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) close(false);
    };
    let raf = 0;
    const onMove = (e: Event) => {
      if (e.type === 'scroll' && menuRef.current?.contains(e.target as Node)) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    menu?.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('touchstart', onDown, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(raf);
      menu?.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('touchstart', onDown, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
    // Only when the menu opens / closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    const l = listRef.current;
    if (!open || !l || active < 0) return;
    const el = l.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!el) return;
    if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight;
  }, [open, active]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  const hasBg = /(^|\s)([\w-]+:)*bg-/.test(className);

  return (
    <>
      <button
        {...buttonProps}
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        autoFocus={autoFocus}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKey}
        className={`${hasBg ? '' : 'bg-white '}text-left cursor-pointer disabled:cursor-not-allowed ${className}${open ? ' ring-2 ring-honey-500/30 border-honey-500' : ''}`}
      >
        <span className="flex w-full min-w-0 items-center gap-1.5">
          <span className="grid min-w-0 flex-1">
            {sizers.map((t, i) => (
              <span key={i} aria-hidden className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-nowrap">
                {t}
              </span>
            ))}
            <span className={`col-start-1 row-start-1 truncate ${!selected && placeholder ? 'text-gray-400' : ''}`}>{shownLabel || ' '}</span>
          </span>
          <ChevronDown aria-hidden className={`h-[1.1em] w-[1.1em] shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {name && <input type="hidden" name={name} value={current} />}

      {open &&
        createPortal(
          <div
            ref={menuRef}
            tabIndex={-1}
            // Clicks and keys here belong to this menu only (not to a table row or form around the field).
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="fixed z-[1000] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-sm text-gray-900 shadow-xl outline-none"
            style={{ top: 0, left: 0, visibility: 'hidden' }}
          >
            {withSearch && (
              <div className="border-b border-gray-100 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      const q = e.target.value;
                      setQuery(q);
                      setActive(nextEnabled(filterOptions(options, q), 0, 1));
                    }}
                    placeholder="Search…"
                    aria-label="Search the list"
                    aria-controls={listId}
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-honey-500 focus:outline-none focus:ring-2 focus:ring-honey-500/30"
                  />
                </div>
              </div>
            )}
            <ul ref={listRef} id={listId} role="listbox" className="relative overflow-y-auto overscroll-contain py-1" style={{ maxHeight: LIST_MAX }}>
              {shown.length === 0 ? (
                <li className="px-3 py-3 text-center text-gray-500">{query ? `No match for "${query}"` : 'Nothing to pick'}</li>
              ) : (
                shown.map((o, i) => {
                  const isSel = o.value === current;
                  const header = o.group && (i === 0 || shown[i - 1].group !== o.group);
                  return (
                    <Fragment key={`${o.value}\u0000${i}`}>
                      {header && (
                        <li role="presentation" className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {o.group}
                        </li>
                      )}
                      <li
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={isSel}
                        aria-disabled={o.disabled || undefined}
                        data-index={i}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => !o.disabled && active !== i && setActive(i)}
                        onClick={() => choose(o)}
                        className={`flex items-start gap-2 px-3 py-2 ${
                          o.disabled ? 'cursor-not-allowed text-gray-300' : `cursor-pointer ${i === active ? 'bg-honey-50 text-gray-900' : 'text-gray-700'}`
                        } ${isSel ? 'font-semibold' : ''}`}
                      >
                        <span className="min-w-0 flex-1 break-words">{o.label || ' '}</span>
                        {isSel && <Check className="mt-0.5 h-4 w-4 shrink-0 text-honey-700" />}
                      </li>
                    </Fragment>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

export default SearchSelect;
