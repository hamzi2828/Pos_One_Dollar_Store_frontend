'use client';

// Contract letter on the shop letterhead: pick a template, print / save as PDF,
// record it as issued. The letter HTML comes from the backend fully escaped
// (services/hr/contractService.js), so it is safe to inject.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, FilePen, Loader2, Printer } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { BACKEND_URL, apiErrorMessage, formatDate } from '@/lib/storeApi';
import { LoadingCard, NoAccessCard, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import TemplateEditorModal from '../../components/TemplateEditorModal';
import { employeeApi, type ContractRender, type ContractTemplate, type Placeholder } from '../../services/employeeApi';

// Uploaded logos live on the backend; '/images/...' defaults are frontend files.
const logoSrc = (url: string) => (!url ? '' : /^https?:\/\//.test(url) ? url : url.startsWith('/uploads') ? `${BACKEND_URL}${url}` : url);

function Letter({ data }: { data: ContractRender }) {
  const h = data.letterhead;
  const [logoOk, setLogoOk] = useState(true);
  return (
    <article className="contract-letter">
      <header className="letterhead">
        {h.logoUrl && logoOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc(h.logoUrl)} alt="" className="letterhead-logo" onError={() => setLogoOk(false)} />
        )}
        <div className="letterhead-text">
          <div className="letterhead-name">{h.shopName}</div>
          {h.shopAddress && <div>{h.shopAddress}</div>}
          {h.shopPhone && <div>{h.shopPhone}</div>}
        </div>
      </header>
      <div className="letter-ref">
        <span>Ref: {data.employee.employeeCode || '—'}</span>
        <span>{formatDate(new Date())}</span>
      </div>
      <div className="letter-body" dangerouslySetInnerHTML={{ __html: data.html }} />
    </article>
  );
}

export default function ContractLetterPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAccess();
  const allowed = can('employees', 'edit');

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [builtin, setBuiltin] = useState<{ name: string; body: string }>({ name: 'Standard employment contract', body: '' });
  const [templateId, setTemplateId] = useState(''); // '' = default
  const [data, setData] = useState<ContractRender | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuedNow, setIssuedNow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lock = useRef(false);
  const reqId = useRef(0);

  useEffect(() => setMounted(true), []);

  const loadTemplates = useCallback(async () => {
    const res = await employeeApi.templates();
    setTemplates(res.data);
    const meta = (res.meta || {}) as { placeholders?: Placeholder[]; builtin?: { name: string; body: string } };
    setPlaceholders(meta.placeholders || []);
    if (meta.builtin) setBuiltin(meta.builtin);
  }, []);

  const render = useCallback(async () => {
    const rid = ++reqId.current;
    try {
      setLoading(true);
      setError(null);
      const res = await employeeApi.contract(id, templateId || undefined);
      if (rid === reqId.current) setData(res);
    } catch (e) {
      if (rid === reqId.current) setError(apiErrorMessage(e, 'Could not prepare the letter.'));
    } finally {
      if (rid === reqId.current) setLoading(false);
    }
  }, [id, templateId]);

  useEffect(() => {
    if (!allowed) return;
    loadTemplates().catch(() => {});
  }, [allowed, loadTemplates]);
  useEffect(() => {
    if (allowed) render();
  }, [allowed, render]);

  const issue = async () => {
    if (lock.current || !data) return;
    if (!window.confirm(`Record that "${data.template.name}" was given to ${data.employee.name} today?`)) return;
    lock.current = true;
    setIssuing(true);
    try {
      await employeeApi.issueContract(id, { templateId: data.template.builtin ? 'builtin' : data.template._id });
      setIssuedNow(true);
      toast.success('Recorded as issued');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not record the contract.'));
    } finally {
      lock.current = false;
      setIssuing(false);
    }
  };

  if (!allowed) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <NoAccessCard text="Contract letters show salary and CNIC, so they need permission to edit employees." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Toolbar */}
        <div className="mb-4 space-y-3">
          <Link href={`/admin/hr/employees/${id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Contract letter{data ? ` · ${data.employee.name}` : ''}</h1>
              <p className="text-xs text-gray-500">Print it, or choose “Save as PDF” in the print window.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white max-w-[14rem]"
                aria-label="Template"
              >
                <option value="">Default template</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                    {t.isDefault ? ' ★' : ''}
                  </option>
                ))}
                <option value="builtin">Built-in standard</option>
              </select>
              <button type="button" onClick={() => setEditorOpen(true)} className={secondaryBtn}>
                <FilePen className="h-4 w-4" /> Templates
              </button>
              <button type="button" onClick={() => window.print()} disabled={!data || loading} className={secondaryBtn}>
                <Printer className="h-4 w-4" /> Print / PDF
              </button>
              <button type="button" onClick={issue} disabled={!data || loading || issuing} aria-busy={issuing} className={primaryBtn}>
                {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Mark as issued
              </button>
            </div>
          </div>

          {issuedNow && (
            <p className="text-xs bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2">
              Recorded in the employee&apos;s “Contracts issued” list. Keep the signed copy — you can upload a photo of it under Documents.
            </p>
          )}
          {data && data.missing.length > 0 && (
            <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-px" />
              <span>
                Blank lines are left for: {data.missing.map((m) => m.label).join(', ')}.{' '}
                <Link href={`/admin/hr/employees/${id}/edit`} className="font-semibold underline">
                  Fill them in
                </Link>{' '}
                or write them by hand.
              </span>
            </div>
          )}
          {data && data.unknown.length > 0 && (
            <p className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
              Unknown placeholders in this template: {data.unknown.map((u) => `{{${u}}}`).join(', ')}. Fix them in Templates.
            </p>
          )}
        </div>

        {loading && !data ? (
          <LoadingCard text="Preparing the letter…" />
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button onClick={render} className={primaryBtn}>
              Try again
            </button>
          </div>
        ) : data ? (
          <div className={`bg-white shadow-sm border border-gray-200 rounded-lg mx-auto max-w-[210mm] px-5 py-6 sm:px-12 sm:py-10 ${loading ? 'opacity-60' : ''}`}>
            <Letter data={data} />
          </div>
        ) : null}
      </div>

      {/* Print copy outside the admin layout, so only the letter is printed. */}
      {mounted && data && createPortal(<div className="contract-print-root"><Letter data={data} /></div>, document.body)}

      {editorOpen && (
        <TemplateEditorModal
          templates={templates}
          placeholders={placeholders}
          builtin={builtin}
          onClose={() => setEditorOpen(false)}
          onChanged={(selectId) => {
            loadTemplates().catch(() => {});
            if (selectId !== undefined && selectId !== templateId) setTemplateId(selectId);
            else render();
          }}
        />
      )}

      <style jsx global>{`
        .contract-letter {
          font-family: Georgia, 'Times New Roman', serif;
          color: #111827;
          font-size: 13.5px;
          line-height: 1.6;
        }
        .contract-letter .letterhead {
          display: flex;
          align-items: center;
          gap: 14px;
          border-bottom: 2px solid #111827;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .contract-letter .letterhead-logo {
          height: 54px;
          width: auto;
          max-width: 140px;
          object-fit: contain;
        }
        .contract-letter .letterhead-text {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11.5px;
          color: #374151;
          line-height: 1.45;
        }
        .contract-letter .letterhead-name {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          letter-spacing: 0.02em;
        }
        .contract-letter .letter-ref {
          display: flex;
          justify-content: space-between;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
          color: #6b7280;
          margin-bottom: 18px;
        }
        .contract-letter h2 {
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin: 0 0 14px;
        }
        .contract-letter h3 {
          font-size: 14px;
          font-weight: 700;
          margin: 16px 0 4px;
          break-after: avoid;
        }
        .contract-letter p {
          margin: 0 0 8px;
          text-align: justify;
        }
        .contract-letter ul {
          list-style: disc;
          padding-left: 22px;
          margin: 0 0 8px;
        }
        .contract-letter li {
          margin-bottom: 2px;
        }
        .contract-letter .blank {
          display: inline-block;
          min-width: 120px;
          border-bottom: 1px solid #6b7280;
          height: 1em;
          vertical-align: baseline;
        }
        .contract-letter .ph-unknown {
          background: #fee2e2;
          color: #b91c1c;
          padding: 0 2px;
        }
        .contract-letter .signatures {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
          margin-top: 40px;
          break-inside: avoid;
          font-family: Arial, Helvetica, sans-serif;
        }
        .contract-letter .sig-title {
          font-weight: 700;
          font-size: 12.5px;
        }
        .contract-letter .sig-line {
          height: 56px;
          border-bottom: 1px solid #111827;
        }
        .contract-letter .sig-caption {
          font-size: 10.5px;
          color: #6b7280;
          margin: 2px 0 6px;
        }
        .contract-letter .sig-row {
          font-size: 11.5px;
          margin-top: 6px;
        }
        .contract-letter .sig-row .blank {
          min-width: 90px;
        }
        @media (max-width: 640px) {
          .contract-letter .signatures {
            grid-template-columns: 1fr;
          }
        }
        .contract-print-root {
          display: none;
        }
        @page {
          size: A4;
          margin: 14mm 15mm 16mm;
        }
        @media print {
          body > *:not(.contract-print-root) {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
          .contract-print-root {
            display: block;
          }
          .contract-print-root .contract-letter .signatures {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
