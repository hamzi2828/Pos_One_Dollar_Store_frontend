// USB barcode scanner on the POS screen, wherever the cursor is.
// Listens to the whole page (capture phase, so it runs before the fields).
// When a scan ends it:
//  - cancels the scanner's Enter/Tab (a focused button is not pressed, the
//    payment box is not submitted, focus does not jump),
//  - puts the field the code was typed into back to what it held before,
//  - hands the code to onScan.
// Normal typing is untouched: people never type 4+ characters that fast.
'use client';

import { useEffect, useRef } from 'react';
import { ScanDetector } from '../utils/scanDetector';

type TextField = HTMLInputElement | HTMLTextAreaElement;

const isTextField = (el: unknown): el is TextField =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(el.type));

/** Set a field's value so React's onChange sees it (React tracks the native setter). */
function setFieldValue(el: TextField, value: string) {
  if (el.value === value) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const detector = new ScanDetector();
    let field: TextField | null = null;
    let before = '';

    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const step = detector.push(e, performance.now(), e.target);
      if (step.kind === 'start') {
        field = isTextField(e.target) ? e.target : null;
        before = field ? field.value : '';
      } else if (step.kind === 'scan') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (field && field.isConnected) setFieldValue(field, before);
        field = null;
        onScanRef.current(step.code);
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
