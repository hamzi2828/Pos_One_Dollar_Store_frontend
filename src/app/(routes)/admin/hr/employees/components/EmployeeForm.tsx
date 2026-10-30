'use client';

// Add / edit an employee: Personal, Job, Salary, Bank, Guarantor & emergency, Documents.
// Saves the record first, then uploads the photo and any documents picked here.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Briefcase,
  Check,
  FileText,
  Landmark,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { apiErrorMessage, formatRs } from '@/lib/storeApi';
import { ErrorBox, Field, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { Avatar, SectionCard } from './EmployeeBits';
import {
  CNIC_PATTERN,
  DAYS,
  DOCUMENT_LABEL,
  EMPLOYMENT_LABEL,
  dateInput,
  employeeApi,
  formatCnicInput,
  type Day,
  type DocumentType,
  type Employee,
  type EmployeePayload,
  type EmploymentType,
} from '../services/employeeApi';
import { SearchSelect } from '@/components/ui/SearchSelect';
import MoneyInput from '@/components/ui/MoneyInput';

type Form = {
  firstName: string;
  lastName: string;
  fatherHusbandName: string;
  cnic: string;
  cnicExpiry: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  qualification: string;
  experience: string;
  previousEmployer: string;
  user: string;
  designation: string;
  department: string;
  employmentType: EmploymentType;
  joiningDate: string;
  probationEndDate: string;
  contractStartDate: string;
  contractEndDate: string;
  shiftStart: string;
  shiftEnd: string;
  weeklyOff: Day[];
  basic: string;
  allowances: { name: string; amount: string }[];
  salaryPayDay: string;
  salaryPaymentMethod: 'cash' | 'bank_transfer' | 'cheque';
  accountTitle: string;
  accountNumber: string;
  bankName: string;
  iban: string;
  gName: string;
  gCnic: string;
  gPhone: string;
  gRelation: string;
  gAddress: string;
  eName: string;
  ePhone: string;
  eRelation: string;
  notes: string;
};

const s = (v?: string | number | null) => (v === null || v === undefined ? '' : String(v));

function toForm(e: Employee | null): Form {
  const allowances = e?.salaryBreakdown?.allowances || [];
  const basic = e?.salaryBreakdown?.basic || (allowances.length ? 0 : e?.salary || 0);
  return {
    firstName: s(e?.firstName),
    lastName: s(e?.lastName),
    fatherHusbandName: s(e?.fatherHusbandName),
    cnic: s(e?.cnic),
    cnicExpiry: dateInput(e?.cnicExpiry),
    dateOfBirth: dateInput(e?.dateOfBirth),
    gender: s(e?.gender),
    maritalStatus: s(e?.maritalStatus),
    phone: s(e?.phone),
    email: s(e?.email),
    street: s(e?.address?.street),
    city: s(e?.address?.city),
    state: s(e?.address?.state),
    qualification: s(e?.qualification),
    experience: s(e?.experience),
    previousEmployer: s(e?.previousEmployer),
    user: e?.user?._id || '',
    designation: s(e?.designation || e?.position),
    department: s(e?.department),
    employmentType: e?.employmentType || 'permanent',
    joiningDate: dateInput(e?.joiningDate || e?.hireDate) || new Date().toISOString().slice(0, 10),
    probationEndDate: dateInput(e?.probationEndDate),
    contractStartDate: dateInput(e?.contractStartDate),
    contractEndDate: dateInput(e?.contractEndDate),
    shiftStart: s(e?.shift?.start) || (e ? '' : '10:00'),
    shiftEnd: s(e?.shift?.end) || (e ? '' : '22:00'),
    weeklyOff: e?.weeklyOff || [],
    basic: basic ? String(basic) : '',
    allowances: allowances.map((a) => ({ name: a.name, amount: String(a.amount) })),
    salaryPayDay: s(e?.salaryPayDay || 7),
    salaryPaymentMethod: e?.salaryPaymentMethod || 'cash',
    accountTitle: s(e?.bankDetails?.accountTitle),
    accountNumber: s(e?.bankDetails?.accountNumber),
    bankName: s(e?.bankDetails?.bankName),
    iban: s(e?.bankDetails?.iban),
    gName: s(e?.guarantor?.name),
    gCnic: s(e?.guarantor?.cnic),
    gPhone: s(e?.guarantor?.phone),
    gRelation: s(e?.guarantor?.relation),
    gAddress: s(e?.guarantor?.address),
    eName: s(e?.emergencyContact?.name),
    ePhone: s(e?.emergencyContact?.phone),
    eRelation: s(e?.emergencyContact?.relationship),
    notes: s(e?.notes),
  };
}

function toPayload(f: Form): EmployeePayload {
  const num = (v: string) => (v.trim() === '' ? 0 : Number(v));
  return {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    fatherHusbandName: f.fatherHusbandName || null,
    cnic: f.cnic || null,
    cnicExpiry: f.cnicExpiry || null,
    dateOfBirth: f.dateOfBirth || null,
    gender: (f.gender || null) as Employee['gender'],
    maritalStatus: (f.maritalStatus || null) as Employee['maritalStatus'],
    phone: f.phone || null,
    email: f.email || null,
    address: { street: f.street || null, city: f.city || null, state: f.state || null },
    qualification: f.qualification || null,
    experience: f.experience || null,
    previousEmployer: f.previousEmployer || null,
    user: f.user || null,
    designation: f.designation || null,
    department: f.department || null,
    employmentType: f.employmentType,
    joiningDate: f.joiningDate || null,
    probationEndDate: f.probationEndDate || null,
    contractStartDate: f.contractStartDate || null,
    contractEndDate: f.contractEndDate || null,
    shift: { start: f.shiftStart || null, end: f.shiftEnd || null },
    weeklyOff: f.weeklyOff,
    salaryBreakdown: {
      basic: num(f.basic),
      allowances: f.allowances.filter((a) => a.name.trim() || a.amount.trim()).map((a) => ({ name: a.name.trim(), amount: num(a.amount) })),
    },
    salary: num(f.basic) + f.allowances.reduce((t, a) => t + num(a.amount), 0),
    salaryPayDay: Number(f.salaryPayDay) || 7,
    salaryPaymentMethod: f.salaryPaymentMethod,
    bankDetails: { accountTitle: f.accountTitle || null, accountNumber: f.accountNumber || null, bankName: f.bankName || null, iban: f.iban || null },
    guarantor: { name: f.gName || null, cnic: f.gCnic || null, phone: f.gPhone || null, relation: f.gRelation || null, address: f.gAddress || null },
    emergencyContact: { name: f.eName || null, phone: f.ePhone || null, relationship: f.eRelation || null },
    notes: f.notes || null,
  };
}

const SECTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'job', label: 'Job' },
  { id: 'salary', label: 'Salary' },
  { id: 'bank', label: 'Bank' },
  { id: 'guarantor', label: 'Guarantor' },
  { id: 'documents', label: 'Documents' },
];

type PendingDoc = { key: number; file: File; type: DocumentType };

export default function EmployeeForm({ employee }: { employee: Employee | null }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() => toForm(employee));
  const [photo, setPhoto] = useState<File | null>(null);
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [docType, setDocType] = useState<DocumentType>('cnic_front');
  const [logins, setLogins] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const docKey = useRef(0);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const input = (k: keyof Form) => ({
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    className: inputClass,
  });

  // Staff logins that can be linked (plus the one already linked).
  useEffect(() => {
    let alive = true;
    employeeApi
      .linkableUsers('', employee?._id)
      .then((list) => alive && setLogins(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [employee?._id]);

  const gross = useMemo(
    () => (Number(f.basic) || 0) + f.allowances.reduce((t, a) => t + (Number(a.amount) || 0), 0),
    [f.basic, f.allowances],
  );
  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const validate = (): string | null => {
    if (!f.firstName.trim()) return 'Please enter the first name.';
    if (f.cnic && !CNIC_PATTERN.test(f.cnic)) return 'CNIC must be 13 digits: 12345-1234567-1.';
    if (f.gCnic && !CNIC_PATTERN.test(f.gCnic)) return 'Guarantor CNIC must be 13 digits: 12345-1234567-1.';
    if (f.contractStartDate && f.contractEndDate && f.contractEndDate < f.contractStartDate) return 'Contract end date is before the start date.';
    if ((f.shiftStart && !f.shiftEnd) || (!f.shiftStart && f.shiftEnd)) return 'Enter both shift start and end time.';
    if (f.allowances.some((a) => a.amount.trim() && !a.name.trim())) return 'Each allowance needs a name.';
    if (Number(f.basic) < 0 || f.allowances.some((a) => Number(a.amount) < 0)) return 'Salary amounts cannot be negative.';
    return null;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (lock.current) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(f);
      const saved = employee ? await employeeApi.update(employee._id, payload) : await employeeApi.create(payload);

      // Files after the record exists. A failed upload does not lose the record.
      const failed: string[] = [];
      if (photo) {
        try {
          await employeeApi.uploadPhoto(saved._id, photo);
        } catch (err) {
          failed.push(`photo (${apiErrorMessage(err)})`);
        }
      }
      const byType = docs.reduce<Record<string, File[]>>((acc, d) => {
        (acc[d.type] ||= []).push(d.file);
        return acc;
      }, {});
      for (const [type, files] of Object.entries(byType)) {
        for (let i = 0; i < files.length; i += 5) {
          try {
            await employeeApi.uploadDocuments(saved._id, type as DocumentType, files.slice(i, i + 5));
          } catch (err) {
            failed.push(`${DOCUMENT_LABEL[type as DocumentType]} (${apiErrorMessage(err)})`);
          }
        }
      }
      if (failed.length) toast.error(`Saved, but some files did not upload: ${failed.join(', ')}`, { duration: 7000 });
      else toast.success(employee ? 'Employee saved' : `Employee added (${saved.employeeCode})`);
      router.push(`/admin/hr/employees/${saved._id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the employee.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      lock.current = false;
      setSaving(false);
    }
  };

  const addDocs = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).map((file) => ({ key: ++docKey.current, file, type: docType }));
    setDocs((prev) => [...prev, ...list]);
  };

  const linkedNow = employee?.user && !logins.some((l) => l._id === employee.user?._id) ? [{ _id: employee.user._id, name: `${employee.user.firstName} ${employee.user.lastName}`.trim(), email: employee.user.email }] : [];

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox message={error} />

      {/* Jump links (long form on a phone) */}
      <nav className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {SECTIONS.map((sec) => (
          <a key={sec.id} href={`#${sec.id}`} className="px-3 py-1 text-xs font-medium rounded-full bg-white border border-gray-200 text-gray-700 hover:border-honey-400 whitespace-nowrap">
            {sec.label}
          </a>
        ))}
      </nav>

      <fieldset disabled={saving} className="space-y-4 min-w-0">
        <div id="personal" className="scroll-mt-20">
          <SectionCard title="Personal details" icon={<User className="h-4 w-4" />}>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Avatar url={photoPreview || employee?.photo} name={`${f.firstName} ${f.lastName}`} size="lg" />
                <div className="space-y-1.5">
                  <label className={`${secondaryBtn} cursor-pointer`}>
                    <UploadCloud className="h-4 w-4" /> {photo || employee?.photo ? 'Change photo' : 'Add photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                  </label>
                  {photo && (
                    <button type="button" onClick={() => setPhoto(null)} className="block text-xs text-gray-500 hover:text-red-600">
                      Remove new photo
                    </button>
                  )}
                  <p className="text-[11px] text-gray-500">JPG / PNG, up to 5 MB</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="First name" required>
                <input {...input('firstName')} placeholder="e.g. Muhammad Ali" autoFocus={!employee} />
              </Field>
              <Field label="Last name">
                <input {...input('lastName')} placeholder="e.g. Khan" />
              </Field>
              <Field label="Father / husband name">
                <input {...input('fatherHusbandName')} placeholder="Shown on the contract (S/O, W/O)" />
              </Field>
              <Field label="CNIC" hint="13 digits — dashes are added for you">
                <input
                  value={f.cnic}
                  onChange={(e) => set('cnic', formatCnicInput(e.target.value))}
                  inputMode="numeric"
                  placeholder="12345-1234567-1"
                  className={`${inputClass} font-mono ${f.cnic && !CNIC_PATTERN.test(f.cnic) ? 'border-red-300' : ''}`}
                />
              </Field>
              <Field label="CNIC expiry">
                <input type="date" {...input('cnicExpiry')} />
              </Field>
              <Field label="Date of birth">
                <input type="date" {...input('dateOfBirth')} />
              </Field>
              <Field label="Gender">
                <SearchSelect {...input('gender')}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </SearchSelect>
              </Field>
              <Field label="Marital status">
                <SearchSelect {...input('maritalStatus')}>
                  <option value="">—</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="widowed">Widowed</option>
                  <option value="divorced">Divorced</option>
                </SearchSelect>
              </Field>
              <Field label="Mobile number">
                <input {...input('phone')} inputMode="tel" placeholder="03xx xxxxxxx" />
              </Field>
              <Field label="Email">
                <input type="email" {...input('email')} placeholder="optional" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Home address">
                  <input {...input('street')} placeholder="House, street, area" />
                </Field>
              </div>
              <Field label="City">
                <input {...input('city')} placeholder="e.g. Lahore" />
              </Field>
              <Field label="Province / region">
                <input {...input('state')} placeholder="e.g. AJK, Punjab" />
              </Field>
              <Field label="Qualification">
                <input {...input('qualification')} placeholder="e.g. Matric, FA, BA" />
              </Field>
              <Field label="Previous employer">
                <input {...input('previousEmployer')} placeholder="optional" />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Experience">
                  <textarea {...input('experience')} rows={2} placeholder="e.g. 2 years as cashier at a superstore" className={`${inputClass} resize-none`} />
                </Field>
              </div>
            </div>
          </SectionCard>
        </div>

        <div id="job" className="scroll-mt-20">
          <SectionCard title="Job" icon={<Briefcase className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Designation">
                <input {...input('designation')} placeholder="e.g. Cashier, Salesman, Store keeper" list="hr-designations" />
                <datalist id="hr-designations">
                  {['Cashier', 'Salesman', 'Sales girl', 'Store keeper', 'Shop manager', 'Warehouse assistant', 'Purchaser', 'Packer', 'Helper', 'Security guard', 'Cleaner', 'Rider'].map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </Field>
              <Field label="Department">
                <input {...input('department')} placeholder="e.g. Sales, Store, Accounts" />
              </Field>
              <Field label="Employment type">
                <SearchSelect {...input('employmentType')}>
                  {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((t) => (
                    <option key={t} value={t}>
                      {EMPLOYMENT_LABEL[t]}
                    </option>
                  ))}
                </SearchSelect>
              </Field>
              <Field label="Joining date">
                <input type="date" {...input('joiningDate')} />
              </Field>
              <Field label="Probation ends" hint="Empty = 3 months after joining on the contract">
                <input type="date" {...input('probationEndDate')} />
              </Field>
              <Field label="Contract start">
                <input type="date" {...input('contractStartDate')} />
              </Field>
              <Field label="Contract end" hint="Empty = no fixed end date">
                <input type="date" {...input('contractEndDate')} />
              </Field>
              <Field label="Staff login (optional)" hint="Link if this person also signs in to the POS">
                <SearchSelect {...input('user')}>
                  <option value="">Not linked</option>
                  {[...linkedNow, ...logins].map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name} — {l.email}
                    </option>
                  ))}
                </SearchSelect>
              </Field>
              <Field label="Shift start">
                <input type="time" {...input('shiftStart')} />
              </Field>
              <Field label="Shift end">
                <input type="time" {...input('shiftEnd')} />
              </Field>
              <Field label="Weekly off">
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d) => {
                    const on = f.weeklyOff.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => set('weeklyOff', on ? f.weeklyOff.filter((x) => x !== d.key) : [...f.weeklyOff, d.key])}
                        className={`px-2 py-1 text-xs rounded-md border ${on ? 'bg-honey-500 border-honey-500 text-gray-900' : 'bg-white border-gray-300 text-gray-700 hover:border-honey-400'}`}
                        aria-pressed={on}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </SectionCard>
        </div>

        <div id="salary" className="scroll-mt-20">
          <SectionCard title="Salary (per month)" icon={<Wallet className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Basic salary (Rs)">
                <MoneyInput value={f.basic} onValue={(v) => set('basic', v)} className={inputClass} placeholder="e.g. 30000" />
              </Field>
              <Field label="Paid by (day of next month)">
                <SearchSelect {...input('salaryPayDay')}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </SearchSelect>
              </Field>
              <Field label="Paid in">
                <SearchSelect {...input('salaryPaymentMethod')}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </SearchSelect>
              </Field>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-700 mb-1.5">Allowances</p>
              <div className="space-y-2">
                {f.allowances.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={a.name}
                      onChange={(e) => set('allowances', f.allowances.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      placeholder="e.g. Conveyance, Food, Mobile"
                      className={inputClass}
                    />
                    <MoneyInput
                      value={a.amount}
                      onValue={(v) => set('allowances', f.allowances.map((x, j) => (j === i ? { ...x, amount: v } : x)))}
                      placeholder="Rs"
                      className={`${inputClass} max-w-[8rem]`}
                    />
                    <button type="button" onClick={() => set('allowances', f.allowances.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600" aria-label="Remove allowance">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => set('allowances', [...f.allowances, { name: '', amount: '' }])} className="text-xs font-medium text-honey-700 hover:text-honey-800 inline-flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add allowance
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-honey-50 border border-honey-100 px-3 py-2">
              <span className="text-sm text-gray-700">Gross monthly salary</span>
              <span className="text-base font-semibold text-gray-900 tabular-nums">{formatRs(gross)}</span>
            </div>
          </SectionCard>
        </div>

        <div id="bank" className="scroll-mt-20">
          <SectionCard title="Bank details" icon={<Landmark className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Account title">
                <input {...input('accountTitle')} />
              </Field>
              <Field label="Bank name">
                <input {...input('bankName')} placeholder="e.g. Meezan Bank, HBL, JazzCash" />
              </Field>
              <Field label="Account number">
                <input {...input('accountNumber')} inputMode="numeric" className={`${inputClass} font-mono`} />
              </Field>
              <Field label="IBAN">
                <input {...input('iban')} placeholder="PK36 MEZN 0000 …" className={`${inputClass} font-mono uppercase`} />
              </Field>
            </div>
          </SectionCard>
        </div>

        <div id="guarantor" className="scroll-mt-20">
          <SectionCard title="Guarantor / reference & emergency contact" icon={<ShieldCheck className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Guarantor name">
                <input {...input('gName')} />
              </Field>
              <Field label="Guarantor CNIC">
                <input
                  value={f.gCnic}
                  onChange={(e) => set('gCnic', formatCnicInput(e.target.value))}
                  inputMode="numeric"
                  placeholder="12345-1234567-1"
                  className={`${inputClass} font-mono ${f.gCnic && !CNIC_PATTERN.test(f.gCnic) ? 'border-red-300' : ''}`}
                />
              </Field>
              <Field label="Guarantor phone">
                <input {...input('gPhone')} inputMode="tel" />
              </Field>
              <Field label="Relation">
                <input {...input('gRelation')} placeholder="e.g. Uncle, Neighbour, Former employer" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Guarantor address">
                  <input {...input('gAddress')} />
                </Field>
              </div>
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Emergency contact name">
                <input {...input('eName')} />
              </Field>
              <Field label="Emergency phone">
                <input {...input('ePhone')} inputMode="tel" />
              </Field>
              <Field label="Relationship">
                <input {...input('eRelation')} placeholder="e.g. Brother, Wife" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Notes">
                <textarea {...input('notes')} rows={2} className={`${inputClass} resize-none`} />
              </Field>
            </div>
          </SectionCard>
        </div>

        <div id="documents" className="scroll-mt-20">
          <SectionCard title="Documents" icon={<FileText className="h-4 w-4" />}>
            {employee && employee.documents.length > 0 && (
              <p className="text-xs text-gray-500 mb-3">
                {employee.documents.length} document(s) already saved — view or remove them on the{' '}
                <Link href={`/admin/hr/employees/${employee._id}`} className="underline">
                  profile page
                </Link>
                .
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <SearchSelect value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} className={`${inputClass} sm:max-w-[12rem]`} aria-label="Document type">
                {(Object.keys(DOCUMENT_LABEL) as DocumentType[]).map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_LABEL[t]}
                  </option>
                ))}
              </SearchSelect>
              <label className={`${secondaryBtn} cursor-pointer`}>
                <UploadCloud className="h-4 w-4" /> Choose files
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addDocs(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">Photos, scans or PDF (5 MB each): CNIC front & back, CV, signed contract.</p>
            {docs.length > 0 && (
              <ul className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {docs.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-xs font-medium text-honey-700 mr-2">{DOCUMENT_LABEL[d.type]}</span>
                      {d.file.name}
                    </span>
                    <button type="button" onClick={() => setDocs(docs.filter((x) => x.key !== d.key))} className="p-1 text-gray-400 hover:text-red-600" aria-label="Remove file">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </fieldset>

      {/* Save bar stays in view while scrolling the form */}
      <div className="sticky bottom-0 z-20 -mx-2 sm:mx-0 bg-white/95 backdrop-blur border border-gray-200 sm:rounded-xl shadow-lg px-4 py-3 flex items-center justify-end gap-2">
        <button type="button" onClick={() => router.back()} disabled={saving} className={secondaryBtn}>
          Cancel
        </button>
        <button type="submit" disabled={saving} aria-busy={saving} className={primaryBtn}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}
        </button>
      </div>
    </form>
  );
}
