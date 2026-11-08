// Print station: this counter prints receipts sent by other counters.
// While enabled, asks the server for a print job every 3 s and prints it
// silently on the receipt printer (no cash drawer). Uses a worker timer so it
// keeps going when the tab is in the background.
'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { printJobsApi, printRemoteJob } from '../utils/printRouter';
import { findReceiptPrinter } from '../utils/cashDrawer';

const POLL_MS = 3000;

/** setInterval that browsers do not slow down in background tabs. */
function startTicker(ms: number, tick: () => void): () => void {
  try {
    const src = `setInterval(function(){postMessage(0)},${ms});`;
    const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = tick;
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = window.setInterval(tick, ms);
    return () => window.clearInterval(id);
  }
}

export type PrinterAgentState = 'checking' | 'ok' | 'missing';

export function usePrintStation(enabled: boolean): { agent: PrinterAgentState } {
  const [agent, setAgent] = useState<PrinterAgentState>('checking');
  const busy = useRef(false);

  // Check the desktop app once when the station starts.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setAgent('checking');
    findReceiptPrinter().then((r) => alive && setAgent(r.printer ? 'ok' : 'missing'));
    return () => {
      alive = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    const run = async () => {
      if (busy.current || stopped) return;
      busy.current = true;
      try {
        // Print every waiting job, one after another.
        for (let i = 0; i < 20 && !stopped; i++) {
          const res = await printJobsApi.claim();
          const job = res?.job;
          if (!job) break;
          const result = await printRemoteJob(job);
          await printJobsApi.done(job.id, result).catch(() => undefined);
          if (result.ok) toast.success(`Printed receipt #${job.orderNumber} for ${job.fromCounterName}`, { id: `job-${job.id}` });
          else toast.error(`Could not print receipt #${job.orderNumber} for ${job.fromCounterName}: ${result.error}`, { duration: 8000 });
        }
      } catch {
        // No internet / server busy: try again on the next tick.
      } finally {
        busy.current = false;
      }
    };

    run();
    const stop = startTicker(POLL_MS, run);
    return () => {
      stopped = true;
      stop();
    };
  }, [enabled]);

  return { agent };
}
