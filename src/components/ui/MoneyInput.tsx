'use client';

// Rupee amount box that shows thousands commas while you type (100000 -> 100,000).
// `value` / `onChange` use the plain number as a string ("100000", "99.5"), so it
// is a drop-in for <input type="number" value={x} onChange={(e) => setX(e.target.value)} />
// with `onValue={setX}` instead of onChange.
import { forwardRef, useLayoutEffect, useRef, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string | number | null | undefined;
  onValue: (plain: string) => void;
  /** Allow a decimal point (default true). */
  decimals?: boolean;
};

/** "1234567.5" -> "1,234,567.5" (keeps a trailing "." while typing). */
export function withCommas(plain: string): string {
  if (!plain) return '';
  const [int, dec] = plain.split('.');
  const grouped = (int || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${grouped || '0'}.${dec}` : grouped;
}

/** Whatever was typed -> plain number string (digits and one ".", no commas). */
export function toPlain(typed: string, decimals = true): string {
  let s = typed.replace(/[^\d.]/g, '');
  if (!decimals) return s.replace(/\./g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return s;
}

const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput({ value, onValue, decimals = true, ...rest }, ref) {
  const inner = useRef<HTMLInputElement | null>(null);
  // Digits typed before the caret, to put the caret back after commas move.
  const caretDigits = useRef<number | null>(null);
  const shown = withCommas(toPlain(value === null || value === undefined ? '' : String(value), decimals));

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || caretDigits.current === null || document.activeElement !== el) return;
    let seen = 0;
    let pos = 0;
    while (pos < shown.length && seen < caretDigits.current) {
      if (/[\d.]/.test(shown[pos])) seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [shown]);

  return (
    <input
      {...rest}
      ref={(el) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={shown}
      onChange={(e) => {
        const caret = e.target.selectionStart ?? e.target.value.length;
        caretDigits.current = e.target.value.slice(0, caret).replace(/[^\d.]/g, '').length;
        onValue(toPlain(e.target.value, decimals));
      }}
    />
  );
});

export default MoneyInput;
