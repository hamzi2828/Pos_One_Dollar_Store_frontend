// Wraps a synchronous jsPDF builder so the "Download PDF" button can show a
// spinner and ignore repeat clicks. jsPDF blocks the main thread, so the work
// is deferred one tick to let the "Generating…" state paint first.
import { useCallback, useRef, useState } from 'react';

export function usePdfExport(build: () => void) {
  const lockRef = useRef(false);
  const [exporting, setExporting] = useState(false);

  const run = useCallback(() => {
    if (lockRef.current) return;
    lockRef.current = true;
    setExporting(true);
    setTimeout(() => {
      try {
        build();
      } finally {
        lockRef.current = false;
        setExporting(false);
      }
    }, 30);
  }, [build]);

  return { exporting, run };
}
