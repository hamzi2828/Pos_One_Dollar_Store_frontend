'use client';

// Employee profile: details, documents gallery, contracts issued, assets in their care.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Check,
  Edit2,
  FileSignature,
  FileText,
  History,
  Landmark,
  Loader2,
  Lock,
  Package,
  Phone,
  ShieldCheck,
  Trash2,
  UploadCloud,
  User,
  UserCog,
  Wallet,
} from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { apiErrorMessage, formatDate, formatRs, storeApi } from '@/lib/storeApi';
import { ErrorBox, Field, LoadingCard, Modal, NoAccessCard, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { Avatar, InfoRow, SectionCard, StatusBadge } from '../components/EmployeeBits';
import EmployeeLoginCard from '../components/EmployeeLoginCard';
import TimePayCard from '../components/TimePayCard';
import {
  DAYS,
  DOCUMENT_LABEL,
  EMPLOYMENT_LABEL,
  STATUS_LABEL,
  employeeApi,
  fileUrl,
  type DocumentType,
  type Employee,
  type EmployeeStatus,
} from '../services/employeeApi';

const fmtTime = (t?: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const ordinal = (n: number) => {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th';
  return `${n}${suffix}`;
};

type AssignedAsset = { _id: string; assetCode?: string; name: string; location?: string; quantity: number; status: string; category?: { name: string } | null };

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAccess();
  const canView = can('employees', 'view');
  const canEdit = can('employees', 'edit');
  const canDelete = can('employees', 'delete');

  const [emp, setEmp] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssignedAsset[] | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // 'delete' | 'upload' | doc id
  const lock = useRef(false);
  const [docType, setDocType] = useState<DocumentType>('cnic_front');

  const load = useCallback(async () => {
    try {
      setError(null);
      setEmp(await employeeApi.get(id));
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load the employee.'));
    }
  }, [id]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  // Assets in this person's care (only if the user may see assets).
  const canAssets = can('assets', 'view');
  useEffect(() => {
    if (!canAssets) return;
    storeApi
      .get<AssignedAsset[]>('/assets', { assignedTo: id, limit: 50, status: 'in_use' })
      .then((r) => setAssets(r.data))
      .catch(() => setAssets([]));
  }, [canAssets, id]);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(key);
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const handleDelete = () => {
    if (!emp || !window.confirm(`Delete ${emp.name}'s record?\n\nThe record is hidden from all lists (it is kept for history).`)) return;
    run('delete', async () => {
      try {
        await employeeApi.remove(emp._id);
        toast.success('Employee deleted');
        router.push('/admin/hr/employees');
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not delete.'));
      }
    });
  };

  const handleUpload = (files: FileList | null) => {
    if (!emp || !files?.length) return;
    const list = Array.from(files).slice(0, 5);
    run('upload', async () => {
      try {
        setEmp(await employeeApi.uploadDocuments(emp._id, docType, list));
        toast.success(list.length === 1 ? 'Document uploaded' : `${list.length} documents uploaded`);
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Upload failed.'));
      }
    });
  };

  const handleRemoveDoc = (docId: string) => {
    if (!emp || !window.confirm('Remove this document?')) return;
    run(docId, async () => {
      try {
        setEmp(await employeeApi.removeDocument(emp._id, docId));
        toast.success('Document removed');
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not remove the document.'));
      }
    });
  };

  if (!canView) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <NoAccessCard />
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 text-center py-10 px-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <div className="flex justify-center gap-2">
            <Link href="/admin/hr/employees" className={secondaryBtn}>
              Back to list
            </Link>
            <button onClick={load} className={primaryBtn}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!emp) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <LoadingCard text="Loading employee…" />
      </div>
    );
  }

  const hidden = emp.sensitiveHidden;
  const cnicExpired = emp.cnicExpiry && new Date(emp.cnicExpiry) < new Date();
  const address = [emp.address?.street, emp.address?.city, emp.address?.state].filter(Boolean).join(', ');
  const allowances = emp.salaryBreakdown?.allowances || [];
  const offDays = (emp.weeklyOff || []).map((d) => DAYS.find((x) => x.key === d)?.label || d).join(', ');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4">
        <Link href="/admin/hr/employees" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Employees
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar url={emp.photo} name={emp.name} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{emp.name}</h1>
                <StatusBadge status={emp.status} />
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {emp.designation || emp.position || 'No designation'}
                {emp.department ? ` · ${emp.department}` : ''} · {EMPLOYMENT_LABEL[emp.employmentType] || 'Permanent'}
              </p>
              <p className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-mono">{emp.employeeCode || 'No code'}</span>
                <span>Joined {formatDate(emp.joiningDate || emp.hireDate)}</span>
                {emp.phone && (
                  <a href={`tel:${emp.phone}`} className="inline-flex items-center gap-1 hover:text-honey-700">
                    <Phone className="h-3 w-3" /> {emp.phone}
                  </a>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Link href={`/admin/hr/employees/${emp._id}/contract`} className={primaryBtn}>
                  <FileSignature className="h-4 w-4" /> Contract letter
                </Link>
              )}
              {canEdit && (
                <Link href={`/admin/hr/employees/${emp._id}/edit`} className={secondaryBtn}>
                  <Edit2 className="h-4 w-4" /> Edit
                </Link>
              )}
              {canEdit && (
                <button type="button" onClick={() => setStatusOpen(true)} className={secondaryBtn}>
                  <UserCog className="h-4 w-4" /> Status
                </button>
              )}
              {canDelete && (
                <button type="button" onClick={handleDelete} disabled={busy === 'delete'} className={`${secondaryBtn} text-red-600 hover:bg-red-50`}>
                  {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
                </button>
              )}
            </div>
          </div>
          {(emp.status === 'resigned' || emp.status === 'terminated') && (
            <p className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700">
              Left on {formatDate(emp.exitDate)}
              {emp.exitReason ? ` — ${emp.exitReason}` : ''}
            </p>
          )}
          {hidden && (
            <p className="mt-3 text-xs flex items-center gap-1.5 text-gray-500">
              <Lock className="h-3.5 w-3.5" /> Salary, bank details and CNIC are only shown to users who can edit employees.
            </p>
          )}
        </div>

        <EmployeeLoginCard employee={emp} onChange={setEmp} />

        {/* Default shift, weekly off, pay type, HR policy, fingerprint status (refreshes the profile after a save). */}
        <TimePayCard employeeId={emp._id} onSaved={load} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Personal" icon={<User className="h-4 w-4" />}>
            <dl className="grid grid-cols-2 gap-3">
              <InfoRow label="Father / husband" value={emp.fatherHusbandName} />
              {!hidden && (
                <InfoRow
                  label="CNIC"
                  value={
                    emp.cnic ? (
                      <span className="font-mono">
                        {emp.cnic}
                        {cnicExpired && <span className="ml-1 text-[10px] font-sans font-semibold text-red-600">EXPIRED</span>}
                      </span>
                    ) : null
                  }
                />
              )}
              {!hidden && <InfoRow label="CNIC expiry" value={emp.cnicExpiry ? formatDate(emp.cnicExpiry) : null} />}
              <InfoRow label="Date of birth" value={emp.dateOfBirth ? formatDate(emp.dateOfBirth) : null} />
              <InfoRow label="Gender" value={emp.gender ? emp.gender[0].toUpperCase() + emp.gender.slice(1) : null} />
              <InfoRow label="Marital status" value={emp.maritalStatus ? emp.maritalStatus[0].toUpperCase() + emp.maritalStatus.slice(1) : null} />
              <InfoRow label="Email" value={emp.email} />
              <InfoRow label="Qualification" value={emp.qualification} />
              <div className="col-span-2">
                <InfoRow label="Address" value={address} />
              </div>
              <InfoRow label="Previous employer" value={emp.previousEmployer} />
              <InfoRow label="Experience" value={emp.experience} />
            </dl>
          </SectionCard>

          <SectionCard title="Job" icon={<Briefcase className="h-4 w-4" />}>
            <dl className="grid grid-cols-2 gap-3">
              <InfoRow label="Employment type" value={EMPLOYMENT_LABEL[emp.employmentType]} />
              <InfoRow label="Joining date" value={formatDate(emp.joiningDate || emp.hireDate)} />
              <InfoRow label="Probation ends" value={emp.probationEndDate ? formatDate(emp.probationEndDate) : null} />
              <InfoRow label="Contract start" value={emp.contractStartDate ? formatDate(emp.contractStartDate) : null} />
              <InfoRow label="Contract end" value={emp.contractEndDate ? formatDate(emp.contractEndDate) : null} />
              <InfoRow label="Shift" value={emp.shift?.start && emp.shift?.end ? `${fmtTime(emp.shift.start)} – ${fmtTime(emp.shift.end)}` : null} />
              <InfoRow label="Weekly off" value={offDays} />
            </dl>
          </SectionCard>

          {!hidden && (
            <SectionCard title="Salary" icon={<Wallet className="h-4 w-4" />}>
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm text-gray-600">Gross per month</span>
                <span className="text-xl font-semibold text-gray-900 tabular-nums">{formatRs(emp.salary)}</span>
              </div>
              <ul className="text-sm divide-y divide-gray-100 border-y border-gray-100">
                <li className="flex justify-between py-1.5">
                  <span className="text-gray-600">Basic</span>
                  <span className="tabular-nums">{formatRs(emp.salaryBreakdown?.basic || (allowances.length ? 0 : emp.salary))}</span>
                </li>
                {allowances.map((a, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span className="text-gray-600">{a.name}</span>
                    <span className="tabular-nums">{formatRs(a.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                Paid by the {ordinal(emp.salaryPayDay || 7)} of the next month ·{' '}
                {emp.salaryPaymentMethod === 'bank_transfer' ? 'Bank transfer' : emp.salaryPaymentMethod === 'cheque' ? 'Cheque' : 'Cash'}
              </p>
            </SectionCard>
          )}

          {!hidden && (
            <SectionCard title="Bank" icon={<Landmark className="h-4 w-4" />}>
              <dl className="grid grid-cols-2 gap-3">
                <InfoRow label="Account title" value={emp.bankDetails?.accountTitle} />
                <InfoRow label="Bank" value={emp.bankDetails?.bankName} />
                <InfoRow label="Account no." value={emp.bankDetails?.accountNumber ? <span className="font-mono">{emp.bankDetails.accountNumber}</span> : null} />
                <InfoRow label="IBAN" value={emp.bankDetails?.iban ? <span className="font-mono text-xs">{emp.bankDetails.iban}</span> : null} />
              </dl>
            </SectionCard>
          )}

          <SectionCard title="Guarantor & emergency contact" icon={<ShieldCheck className="h-4 w-4" />}>
            <dl className="grid grid-cols-2 gap-3">
              <InfoRow label="Guarantor" value={emp.guarantor?.name} />
              <InfoRow label="Relation" value={emp.guarantor?.relation} />
              <InfoRow label="Phone" value={emp.guarantor?.phone} />
              {!hidden && <InfoRow label="CNIC" value={emp.guarantor?.cnic ? <span className="font-mono">{emp.guarantor.cnic}</span> : null} />}
              <div className="col-span-2">
                <InfoRow label="Address" value={emp.guarantor?.address} />
              </div>
              <div className="col-span-2 border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
                <InfoRow label="Emergency contact" value={emp.emergencyContact?.name ? `${emp.emergencyContact.name}${emp.emergencyContact.relationship ? ` (${emp.emergencyContact.relationship})` : ''}` : null} />
                <InfoRow label="Emergency phone" value={emp.emergencyContact?.phone} />
              </div>
            </dl>
          </SectionCard>

          {emp.notes && (
            <SectionCard title="Notes" icon={<FileText className="h-4 w-4" />}>
              <p className="text-sm text-gray-700 whitespace-pre-line">{emp.notes}</p>
            </SectionCard>
          )}
        </div>

        {/* Documents */}
        <SectionCard
          title={`Documents (${emp.documents.length})`}
          icon={<FileText className="h-4 w-4" />}
          action={
            canEdit ? (
              <div className="flex items-center gap-1.5">
                <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} className="text-xs border border-gray-300 rounded-md px-1.5 py-1" aria-label="Document type">
                  {(Object.keys(DOCUMENT_LABEL) as DocumentType[]).map((t) => (
                    <option key={t} value={t}>
                      {DOCUMENT_LABEL[t]}
                    </option>
                  ))}
                </select>
                <label className={`inline-flex items-center gap-1 text-xs font-medium text-honey-700 hover:text-honey-800 cursor-pointer ${busy === 'upload' ? 'opacity-60 pointer-events-none' : ''}`}>
                  {busy === 'upload' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />} Upload
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleUpload(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            ) : undefined
          }
        >
          {emp.documents.length === 0 ? (
            <p className="text-sm text-gray-500">No documents yet{canEdit ? ' — upload CNIC front & back, CV and the signed contract.' : '.'}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {emp.documents.map((d) => (
                <div key={d._id} className="group relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <a href={fileUrl(d.url)} target="_blank" rel="noreferrer" className="block aspect-[4/3]">
                    {/\.pdf($|\?)/i.test(d.url) ? (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-red-600">
                        <FileText className="h-8 w-8" />
                        <span className="text-[11px] font-semibold">PDF</span>
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(d.url)} alt={DOCUMENT_LABEL[d.type]} className="h-full w-full object-cover" />
                    )}
                  </a>
                  <div className="px-2 py-1.5 bg-white border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-800 truncate">{d.name || DOCUMENT_LABEL[d.type]}</p>
                    <p className="text-[10px] text-gray-500">{formatDate(d.uploadedAt)}</p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(d._id)}
                      disabled={busy === d._id}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/90 text-gray-500 hover:text-red-600 shadow sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      aria-label="Remove document"
                    >
                      {busy === d._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Contracts issued */}
        <SectionCard
          title="Contracts issued"
          icon={<FileSignature className="h-4 w-4" />}
          action={
            canEdit ? (
              <Link href={`/admin/hr/employees/${emp._id}/contract`} className="text-xs font-medium text-honey-700 hover:text-honey-800">
                Open letter
              </Link>
            ) : undefined
          }
        >
          {emp.contractsIssued.length === 0 ? (
            <p className="text-sm text-gray-500">No contract issued yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="text-xs text-gray-500 text-left">
                  <tr>
                    <th className="font-medium py-1.5 px-4 sm:px-0">Issued</th>
                    <th className="font-medium py-1.5">Template</th>
                    <th className="font-medium py-1.5">Period</th>
                    {!hidden && <th className="font-medium py-1.5 text-right">Salary</th>}
                    <th className="font-medium py-1.5 pl-3">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...emp.contractsIssued].reverse().map((c) => (
                    <tr key={c._id}>
                      <td className="py-2 px-4 sm:px-0 whitespace-nowrap">{formatDate(c.issuedAt)}</td>
                      <td className="py-2">{c.templateName}</td>
                      <td className="py-2 text-gray-600 whitespace-nowrap">
                        {formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : 'open'}
                      </td>
                      {!hidden && <td className="py-2 text-right tabular-nums">{formatRs(c.salary)}</td>}
                      <td className="py-2 pl-3 text-gray-600">{c.issuedByName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {canAssets && (
          <SectionCard title="Assets in their care" icon={<Package className="h-4 w-4" />} action={<Link href="/admin/assets" className="text-xs font-medium text-honey-700">Asset register</Link>}>
            {assets === null ? (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : assets.length === 0 ? (
              <p className="text-sm text-gray-500">No assets assigned.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {assets.map((a) => (
                  <li key={a._id} className="py-2 flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900">{a.name}</span>
                      {a.quantity > 1 && <span className="text-gray-500"> × {a.quantity}</span>}
                      <span className="block text-xs text-gray-500">
                        <span className="font-mono">{a.assetCode}</span> · {a.category?.name || 'Uncategorised'}
                        {a.location ? ` · ${a.location}` : ''}
                      </span>
                    </span>
                    {a.status === 'maintenance' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Maintenance</span>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {emp.history && emp.history.length > 0 && (
          <SectionCard title="History" icon={<History className="h-4 w-4" />}>
            <ul className="space-y-1 text-xs text-gray-600">
              {[...emp.history]
                .reverse()
                .slice(0, 12)
                .map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gray-400 whitespace-nowrap">{formatDate(h.at, true)}</span>
                    <span>
                      {h.action.replace('status:', 'Status ').replace('->', ' → ').replace(/_/g, ' ')}
                      {h.note ? ` — ${h.note}` : ''}
                    </span>
                  </li>
                ))}
            </ul>
          </SectionCard>
        )}
      </div>

      {statusOpen && (
        <StatusModal
          employee={emp}
          onClose={() => setStatusOpen(false)}
          onSaved={(e) => {
            setEmp(e);
            setStatusOpen(false);
            if (e.linkedLoginStillActive) {
              toast('Their staff login is still active. Disable it on the Staff Logins page.', { icon: '⚠️', duration: 7000 });
            }
          }}
        />
      )}
    </div>
  );
}

function StatusModal({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: (e: Employee) => void }) {
  const [status, setStatus] = useState<EmployeeStatus>(employee.status);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const leaving = status === 'resigned' || status === 'terminated';

  const save = async () => {
    if (lock.current) return;
    if (status === employee.status && !leaving) return onClose();
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await employeeApi.setStatus(employee._id, { status, date: leaving ? date : undefined, reason: reason.trim() || undefined });
      toast.success(`Status: ${STATUS_LABEL[status]}`);
      onSaved(updated);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not change the status.'));
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Change status"
      subtitle={employee.name}
      icon={<UserCog className="h-5 w-5" />}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} aria-busy={saving} className={primaryBtn}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
          </button>
        </>
      }
    >
      <fieldset disabled={saving} className="space-y-4">
        <ErrorBox message={error} />
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-3 py-2 text-sm rounded-lg border text-left ${status === s ? 'border-honey-500 bg-honey-50 text-honey-800 font-medium' : 'border-gray-300 text-gray-700 hover:border-honey-300'}`}
              aria-pressed={status === s}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {leaving && (
          <>
            <Field label="Last working day" required>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Reason">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={status === 'resigned' ? 'e.g. Moved to another city' : 'e.g. Repeated till shortages after warnings'} className={`${inputClass} resize-none`} />
            </Field>
            {employee.user && employee.user.isActive !== false && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> This person has a staff login. Remember to disable it on the Staff Logins page.
              </p>
            )}
          </>
        )}
        {!leaving && (
          <Field label="Note (optional)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={status === 'on_leave' ? 'e.g. Annual leave until 25 Oct' : ''} className={inputClass} />
          </Field>
        )}
      </fieldset>
    </Modal>
  );
}
