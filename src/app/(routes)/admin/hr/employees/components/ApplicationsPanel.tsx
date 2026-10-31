'use client';

// Job applications sent from the public join link: list, details, approve / reject.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, Check, FileText, Inbox, Loader2, Phone, UserCheck, UserX, X } from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate } from '@/lib/storeApi';
import { ErrorBox, Field, LoadingCard, Modal, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { SearchSelect } from '@/components/ui/SearchSelect';
import DesignationField from './DesignationField';
import MoneyInput from '@/components/ui/MoneyInput';
import { Tabs, isPdf, todayInput } from '../../../purchasing/_shared/ui';
import { Avatar, InfoRow, Pager } from './EmployeeBits';
import { EMPLOYMENT_LABEL, fileUrl, type EmploymentType } from '../services/employeeApi';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_STYLE,
  employeeIdOf,
  joinAdminApi,
  type ApplicationListMeta,
  type ApplicationStatus,
  type EmployeeApplication,
  type PayType,
} from '../services/joinApi';

type Filter = ApplicationStatus | 'all';
const LIMIT = 20;

const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other' };
const MARITAL_LABEL: Record<string, string> = { single: 'Single', married: 'Married', widowed: 'Widowed', divorced: 'Divorced' };

export function ApplicationStatusChip({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap ${APPLICATION_STATUS_STYLE[status] || 'bg-gray-100 text-gray-700'}`}>
      {APPLICATION_STATUS_LABEL[status] || status}
    </span>
  );
}

export default function ApplicationsPanel({ onCounts }: { onCounts?: (c: ApplicationListMeta['counts']) => void }) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<EmployeeApplication[]>([]);
  const [meta, setMeta] = useState<ApplicationListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => setPage(1), [filter]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      setLoading(true);
      setError(null);
      const res = await joinAdminApi.applications({ status: filter, page, limit: LIMIT });
      if (id !== reqId.current) return;
      setRows(res.data || []);
      const m = (res.meta as unknown as ApplicationListMeta) || null;
      setMeta(m);
      if (m?.counts) onCounts?.(m.counts);
    } catch (e) {
      if (id === reqId.current) setError(apiErrorMessage(e, 'Could not load applications.'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [filter, page, onCounts]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = meta?.counts;
  const pages = meta ? meta.pages ?? Math.max(1, Math.ceil(meta.total / (meta.limit || LIMIT))) : 1;
  const open = rows.find((r) => r._id === openId) || null;

  return (
    <div className="space-y-3">
      <Tabs<Filter>
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'pending', label: 'Pending', count: counts?.pending },
          { value: 'approved', label: 'Approved', count: counts?.approved },
          { value: 'rejected', label: 'Rejected', count: counts?.rejected },
          { value: 'all', label: 'All', count: counts ? counts.pending + counts.approved + counts.rejected : undefined },
        ]}
      />

      {loading && !rows.length ? (
        <LoadingCard text="Loading applications…" />
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button onClick={load} className={primaryBtn}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12 px-4">
          <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No applications</h3>
          <p className="text-sm text-gray-500">Share the join link and forms people send will show here.</p>
        </div>
      ) : (
        <div className={`space-y-3 ${loading ? 'opacity-60 pointer-events-none' : ''}`} aria-busy={loading}>
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Applicant</th>
                  <th className="text-left font-medium px-4 py-2.5">Phone</th>
                  <th className="text-left font-medium px-4 py-2.5">CNIC</th>
                  <th className="text-left font-medium px-4 py-2.5">Sent</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((a) => (
                  <tr key={a._id} onClick={() => setOpenId(a._id)} className="hover:bg-honey-50/40 cursor-pointer">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar url={a.photo} name={a.name || a.firstName} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{a.name || a.firstName}</p>
                          <p className="text-xs text-gray-500 font-mono">{a.reference}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{a.phone || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700 font-mono whitespace-nowrap">{a.cnic || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                      {formatDate(a.submittedAt, true)}
                      {a.updatedBySubmitterAt && <p className="text-[11px] text-amber-700">Updated by applicant {formatDate(a.updatedBySubmitterAt, true)}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <ApplicationStatusChip status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {rows.map((a) => (
              <button
                key={a._id}
                type="button"
                onClick={() => setOpenId(a._id)}
                className="w-full text-left flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 shadow-sm active:bg-gray-50"
              >
                <Avatar url={a.photo} name={a.name || a.firstName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 truncate">{a.name || a.firstName}</p>
                    <ApplicationStatusChip status={a.status} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    <span className="font-mono">{a.reference}</span> · {formatDate(a.submittedAt)}
                  </p>
                  {a.updatedBySubmitterAt && <p className="text-[11px] text-amber-700">Updated by applicant {formatDate(a.updatedBySubmitterAt)}</p>}
                  {a.phone && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {a.phone}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {meta && <Pager page={meta.page} pages={pages} total={meta.total} onPage={setPage} disabled={loading} />}
        </div>
      )}

      {open && (
        <ApplicationModal
          initial={open}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ApplicationModal({ initial, onClose, onChanged }: { initial: EmployeeApplication; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const { can } = useAccess();
  const canApprove = can('employees', 'create');
  const canReject = can('employees', 'edit');

  const [app, setApp] = useState<EmployeeApplication>(initial);
  const [mode, setMode] = useState<'view' | 'approve' | 'reject'>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [job, setJob] = useState({
    designation: '',
    department: '',
    joiningDate: todayInput(),
    salary: '',
    payType: 'monthly' as PayType,
    employmentType: 'permanent' as EmploymentType,
  });
  const [reason, setReason] = useState('');

  useEffect(() => {
    let live = true;
    joinAdminApi
      .application(initial._id)
      .then((a) => live && a && setApp(a))
      .catch(() => {}); // the list row is enough to show
    return () => {
      live = false;
    };
  }, [initial._id]);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const salary = job.salary.trim() === '' ? undefined : Number(job.salary);
      const res = await joinAdminApi.approve(app._id, {
        designation: job.designation.trim() || undefined,
        department: job.department.trim() || undefined,
        joiningDate: job.joiningDate || undefined,
        salary: salary !== undefined && Number.isFinite(salary) ? salary : undefined,
        payType: job.payType,
        employmentType: job.employmentType,
      });
      toast.success('Approved — employee added');
      onChanged();
      if (res?.employeeId) router.push(`/admin/hr/employees/${res.employeeId}`);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not approve.'));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinAdminApi.reject(app._id, reason.trim());
      toast.success('Application rejected');
      onChanged();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not reject.'));
    } finally {
      setBusy(false);
    }
  };

  const name = app.name || [app.firstName, app.lastName].filter(Boolean).join(' ');
  const employeeId = employeeIdOf(app);
  const pending = app.status === 'pending';
  const addr = [app.address?.street, app.address?.city, app.address?.state].filter(Boolean).join(', ');

  const footer =
    mode === 'approve' ? (
      <>
        <button type="button" onClick={() => setMode('view')} className={secondaryBtn} disabled={busy}>
          Back
        </button>
        <button type="button" onClick={approve} className={primaryBtn} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve and add employee
        </button>
      </>
    ) : mode === 'reject' ? (
      <>
        <button type="button" onClick={() => setMode('view')} className={secondaryBtn} disabled={busy}>
          Back
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
        </button>
      </>
    ) : (
      <>
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Close
        </button>
        {pending && canReject && (
          <button type="button" onClick={() => setMode('reject')} className={`${secondaryBtn} !text-red-600`}>
            <UserX className="h-4 w-4" /> Reject
          </button>
        )}
        {pending && canApprove && (
          <button type="button" onClick={() => setMode('approve')} className={primaryBtn}>
            <UserCheck className="h-4 w-4" /> Approve
          </button>
        )}
      </>
    );

  return (
    <Modal title={name || 'Application'} subtitle={`${app.reference} · sent ${formatDate(app.submittedAt, true)}`} onClose={onClose} busy={busy} wide footer={footer}>
      <div className="space-y-5">
        <ErrorBox message={error} />

        {mode === 'approve' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This adds <span className="font-medium text-gray-900">{name}</span> as an employee with the details from the form. Everything below is
              optional — you can fill it later on the employee page.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Designation">
                <DesignationField value={job.designation} onChange={(v) => setJob({ ...job, designation: v })} />
              </Field>
              <Field label="Department">
                <input value={job.department} onChange={(e) => setJob({ ...job, department: e.target.value })} className={inputClass} placeholder="e.g. Sales, Store, Accounts" />
              </Field>
              <Field label="Joining date">
                <input type="date" value={job.joiningDate} onChange={(e) => setJob({ ...job, joiningDate: e.target.value })} className={inputClass} />
              </Field>
              <Field label={job.payType === 'daily' ? 'Salary per day (Rs)' : 'Salary per month (Rs)'}>
                <MoneyInput
                  value={job.salary}
                  onValue={(v) => setJob({ ...job, salary: v })}
                  className={inputClass}
                  placeholder="e.g. 30000"
                />
              </Field>
              <Field label="Pay type">
                <SearchSelect value={job.payType} onChange={(e) => setJob({ ...job, payType: e.target.value as PayType })} className={inputClass}>
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </SearchSelect>
              </Field>
              <Field label="Employment type">
                <SearchSelect value={job.employmentType} onChange={(e) => setJob({ ...job, employmentType: e.target.value as EmploymentType })} className={inputClass}>
                  {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((t) => (
                    <option key={t} value={t}>
                      {EMPLOYMENT_LABEL[t]}
                    </option>
                  ))}
                </SearchSelect>
              </Field>
            </div>
          </div>
        )}

        {mode === 'reject' && (
          <Field label="Reason" hint="Optional. Only staff see this.">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="e.g. No vacancy right now" autoFocus />
          </Field>
        )}

        {mode === 'view' && (
          <>
            <div className="flex items-center gap-4">
              <Avatar url={app.photo} name={name || '?'} size="lg" />
              <div className="min-w-0 space-y-1">
                <ApplicationStatusChip status={app.status} />
                {app.updatedBySubmitterAt && <p className="text-xs text-amber-700">Updated by applicant {formatDate(app.updatedBySubmitterAt, true)}</p>}
                {app.status !== 'pending' && (
                  <p className="text-xs text-gray-500">
                    {APPLICATION_STATUS_LABEL[app.status]} {app.reviewedAt ? formatDate(app.reviewedAt, true) : ''}
                    {app.reviewedByName ? ` by ${app.reviewedByName}` : ''}
                  </p>
                )}
                {app.status === 'rejected' && app.rejectReason && <p className="text-sm text-gray-700">Reason: {app.rejectReason}</p>}
                {employeeId && (
                  <Link href={`/admin/hr/employees/${employeeId}`} className="text-sm font-medium text-honey-700 hover:underline">
                    Open employee →
                  </Link>
                )}
              </div>
            </div>

            <DetailBlock title="Personal details">
              <InfoRow label="Name" value={name} />
              <InfoRow label="Father / husband name" value={app.fatherHusbandName} />
              <InfoRow label="Mobile number" value={app.phone} />
              <InfoRow label="Email" value={app.email} />
              <InfoRow label="CNIC" value={app.cnic && <span className="font-mono">{app.cnic}</span>} />
              <InfoRow label="CNIC expiry" value={app.cnicExpiry ? formatDate(app.cnicExpiry) : null} />
              <InfoRow label="Date of birth" value={app.dateOfBirth ? formatDate(app.dateOfBirth) : null} />
              <InfoRow label="Gender" value={app.gender ? GENDER_LABEL[app.gender] : null} />
              <InfoRow label="Marital status" value={app.maritalStatus ? MARITAL_LABEL[app.maritalStatus] : null} />
              <InfoRow label="Home address" value={addr} />
            </DetailBlock>

            <DetailBlock title="Education & work">
              <InfoRow label="Qualification" value={app.qualification} />
              <InfoRow label="Previous employer" value={app.previousEmployer} />
              <div className="sm:col-span-2">
                <InfoRow label="Experience" value={app.experience} />
              </div>
            </DetailBlock>

            <DetailBlock title="Emergency contact">
              <InfoRow label="Name" value={app.emergencyContact?.name} />
              <InfoRow label="Phone" value={app.emergencyContact?.phone} />
              <InfoRow label="Relationship" value={app.emergencyContact?.relationship} />
            </DetailBlock>

            <DetailBlock title="Guarantor / reference">
              <InfoRow label="Name" value={app.guarantor?.name} />
              <InfoRow label="CNIC" value={app.guarantor?.cnic && <span className="font-mono">{app.guarantor.cnic}</span>} />
              <InfoRow label="Phone" value={app.guarantor?.phone} />
              <InfoRow label="Relation" value={app.guarantor?.relation} />
              <div className="sm:col-span-2">
                <InfoRow label="Address" value={app.guarantor?.address} />
              </div>
            </DetailBlock>

            <DetailBlock title="Bank details">
              <InfoRow label="Account title" value={app.bankDetails?.accountTitle} />
              <InfoRow label="Bank name" value={app.bankDetails?.bankName} />
              <InfoRow label="Account number" value={app.bankDetails?.accountNumber} />
              <InfoRow label="IBAN" value={app.bankDetails?.iban && <span className="font-mono">{app.bankDetails.iban}</span>} />
            </DetailBlock>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Documents</h3>
              {app.files?.length ? (
                <div className="flex flex-wrap gap-2">
                  {app.files.map((file, i) => (
                    <a
                      key={`${file.url}-${i}`}
                      href={fileUrl(file.url)}
                      target="_blank"
                      rel="noreferrer"
                      title={file.name || 'Open file'}
                      className="h-24 w-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 block"
                    >
                      {isPdf(file.name || file.url, file.type) ? (
                        <span className="h-full w-full flex flex-col items-center justify-center gap-1 bg-red-50 text-red-700 px-1.5">
                          <FileText className="h-6 w-6 shrink-0" />
                          <span className="w-full truncate text-center text-[10px] leading-tight">{file.name || 'PDF'}</span>
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(file.url)} alt={file.name || 'Document'} className="h-full w-full object-cover" />
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No files sent.</p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{title}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">{children}</dl>
    </div>
  );
}
