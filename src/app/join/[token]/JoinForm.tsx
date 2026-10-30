'use client';

// Job application form behind the public join link. Mobile first: most people
// open it from WhatsApp on a phone.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  Briefcase,
  Camera,
  CheckCircle2,
  FileText,
  Home,
  ImagePlus,
  Landmark,
  Loader2,
  Paperclip,
  Phone,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { Wordmark } from '@/components/ui/wordmark';
import { Field, ErrorBox, inputClass } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import { CNIC_PATTERN, formatCnicInput } from '@/app/(routes)/admin/hr/employees/services/employeeApi';
import { joinPublicApi, type ApplicantDetails } from '@/app/(routes)/admin/hr/employees/services/joinApi';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 5;
// Hosting refuses one request over ~4.5 MB, so photos are shrunk before sending.
const MAX_TOTAL_BYTES = 4.3 * 1024 * 1024;

type Gender = '' | 'male' | 'female' | 'other';
type Marital = '' | 'single' | 'married' | 'widowed' | 'divorced';

const EMPTY = {
  firstName: '',
  lastName: '',
  fatherHusbandName: '',
  phone: '',
  email: '',
  cnic: '',
  cnicExpiry: '',
  dateOfBirth: '',
  gender: '' as Gender,
  maritalStatus: '' as Marital,
  street: '',
  city: '',
  state: '',
  qualification: '',
  experience: '',
  previousEmployer: '',
  eName: '',
  ePhone: '',
  eRelation: '',
  gName: '',
  gCnic: '',
  gPhone: '',
  gRelation: '',
  gAddress: '',
  accountTitle: '',
  bankName: '',
  accountNumber: '',
  iban: '',
};
type FormState = typeof EMPTY;
type Key = keyof FormState;

const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Shrinks a big phone photo to a JPEG of at most 1600 px. Other files are returned as they are. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 700 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

const s = (v: string) => v.trim() || null;

function toDetails(f: FormState): ApplicantDetails {
  return {
    firstName: f.firstName.trim(),
    lastName: s(f.lastName),
    fatherHusbandName: s(f.fatherHusbandName),
    phone: f.phone.trim(),
    email: s(f.email),
    cnic: s(f.cnic),
    cnicExpiry: f.cnicExpiry || null,
    dateOfBirth: f.dateOfBirth || null,
    gender: f.gender || null,
    maritalStatus: f.maritalStatus || null,
    qualification: s(f.qualification),
    experience: s(f.experience),
    previousEmployer: s(f.previousEmployer),
    address: { street: s(f.street), city: s(f.city), state: s(f.state), country: 'Pakistan' },
    emergencyContact: { name: s(f.eName), phone: s(f.ePhone), relationship: s(f.eRelation) },
    guarantor: { name: s(f.gName), cnic: s(f.gCnic), phone: s(f.gPhone), relation: s(f.gRelation), address: s(f.gAddress) },
    bankDetails: { accountTitle: s(f.accountTitle), bankName: s(f.bankName), accountNumber: s(f.accountNumber), iban: s(f.iban)?.toUpperCase() ?? null },
  };
}

// ---------------------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="relative overflow-hidden bg-brand-ink">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,214,10,0.16) 0%, transparent 60%)' }}
        />
        <div className="relative mx-auto max-w-2xl px-4 py-6 sm:py-8 text-center">
          <h1>
            <Wordmark className="text-3xl sm:text-4xl" />
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/60">Job application</p>
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-brand-yellow/70 to-transparent" />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 sm:py-8">{children}</main>
    </div>
  );
}

function Section({ title, icon, note, children }: { title: string; icon: React.ReactNode; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="text-honey-700">{icon}</span>
          {title}
        </h2>
        {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
      </div>
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Choice<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? ('' as T) : o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
            value === o.value ? 'bg-honey-500 border-honey-500 text-gray-900 font-semibold' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CenterCard({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12 px-5">
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function JoinForm({ token }: { token: string }) {
  const [phase, setPhase] = useState<'loading' | 'invalid' | 'form' | 'done'>('loading');
  const [loadError, setLoadError] = useState('');
  const [shopName, setShopName] = useState('DOLLAR & Co');
  const [f, setF] = useState<FormState>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileNote, setFileNote] = useState('');
  const [website, setWebsite] = useState(''); // honeypot: people never see it
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const info = await joinPublicApi.info(token);
      if (info?.shopName) setShopName(info.shopName);
      if (info && info.open === false) {
        setLoadError('This link is closed. Ask the shop for a new link.');
        setPhase('invalid');
        return;
      }
      setPhase('form');
    } catch (e) {
      const notFound = axios.isAxiosError(e) && e.response?.status === 404;
      setLoadError(
        notFound
          ? apiErrorMessage(e, 'This link is not working. Ask the shop for a new link.')
          : 'Could not open the form. Check your internet and try again.',
      );
      setPhase('invalid');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!photo) {
      setPhotoUrl('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const set = <K extends Key>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const input = (k: Key) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as FormState[typeof k]),
    className: inputClass + ' !py-2.5 !text-base sm:!text-sm',
  });

  const pickPhoto = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('The photo must be a picture (JPG or PNG).');
      return;
    }
    const small = await shrinkImage(file);
    if (small.size > MAX_FILE_BYTES) {
      setError('This photo is too big (max 4 MB).');
      return;
    }
    setError(null);
    setPhoto(small);
  };

  const pickDocs = async (list: FileList | null) => {
    const picked = Array.from(list || []);
    const ok = picked.filter((x) => x.type.startsWith('image/') || isPdfFile(x));
    const shrunk = await Promise.all(ok.map(shrinkImage));
    const tooBig = shrunk.filter((x) => x.size > MAX_FILE_BYTES).map((x) => x.name);
    const keep = shrunk.filter((x) => x.size <= MAX_FILE_BYTES);
    const next = [...files, ...keep].slice(0, MAX_FILES);
    const notes: string[] = [];
    if (picked.length > ok.length) notes.push('Only pictures or PDF files can be added.');
    if (tooBig.length) notes.push(`Too big (max 4 MB): ${tooBig.join(', ')}`);
    if (files.length + keep.length > MAX_FILES) notes.push(`Only ${MAX_FILES} files can be added.`);
    setFileNote(notes.join(' '));
    setFiles(next);
  };

  const showError = (msg: string) => {
    setError(msg);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!f.firstName.trim()) return showError('Please write your first name.');
    if (f.phone.replace(/\D/g, '').length < 10) return showError('Please write a correct mobile number (e.g. 0300 1234567).');
    if (f.cnic && !CNIC_PATTERN.test(f.cnic)) return showError('CNIC must have 13 digits (12345-1234567-1).');
    if (f.gCnic && !CNIC_PATTERN.test(f.gCnic)) return showError('Guarantor CNIC must have 13 digits (12345-1234567-1).');
    const total = (photo?.size || 0) + files.reduce((n, x) => n + x.size, 0);
    if (total > MAX_TOTAL_BYTES) return showError('Your photo and files are too big together (max about 4 MB). Remove a file or add smaller ones.');

    setSending(true);
    setError(null);
    try {
      const res = await joinPublicApi.submit(token, toDetails(f), photo, files, website);
      setReference(res?.reference || '');
      setPhase('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showError(apiErrorMessage(err, 'Could not send your form. Check your internet and try again.'));
    } finally {
      setSending(false);
    }
  };

  if (phase === 'loading') {
    return (
      <Shell>
        <CenterCard icon={<Loader2 className="h-8 w-8 text-honey-700 animate-spin" />} title="Opening the form…" />
      </Shell>
    );
  }

  if (phase === 'invalid') {
    return (
      <Shell>
        <CenterCard icon={<AlertCircle className="h-10 w-10 text-red-400" />} title="This link does not work">
          <p className="text-sm text-gray-600">{loadError}</p>
          <button type="button" onClick={load} className="mt-5 text-sm font-medium text-honey-700 underline">
            Try again
          </button>
        </CenterCard>
      </Shell>
    );
  }

  if (phase === 'done') {
    return (
      <Shell>
        <CenterCard icon={<CheckCircle2 className="h-12 w-12 text-green-500" />} title="Thank you!">
          {reference && (
            <p className="text-sm text-gray-700">
              Your reference is <span className="font-mono font-semibold text-gray-900">{reference}</span>.
            </p>
          )}
          <p className="mt-1 text-sm text-gray-600">The shop will contact you.</p>
        </CenterCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Work at {shopName}</h2>
        <p className="mt-1 text-sm text-gray-600">
          Fill in your details and send. Only <span className="font-medium">first name</span> and <span className="font-medium">mobile number</span> are
          a must.
        </p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        {/* Honeypot: hidden from people, bots fill it. */}
        <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
          <label>
            Website
            <input name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <Section title="Your details" icon={<User className="h-4 w-4" />}>
          <Field label="First name" required>
            <input {...input('firstName')} autoComplete="given-name" placeholder="e.g. Muhammad Ali" />
          </Field>
          <Field label="Last name">
            <input {...input('lastName')} autoComplete="family-name" placeholder="e.g. Khan" />
          </Field>
          <Field label="Father / husband name">
            <input {...input('fatherHusbandName')} placeholder="S/O or W/O" />
          </Field>
          <Field label="Mobile number" required>
            <input {...input('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="03xx xxxxxxx" />
          </Field>
          <Field label="Email">
            <input {...input('email')} type="email" inputMode="email" autoComplete="email" placeholder="optional" />
          </Field>
          <Field label="CNIC" hint="13 digits — dashes are added for you">
            <input
              {...input('cnic')}
              onChange={(e) => set('cnic', formatCnicInput(e.target.value))}
              inputMode="numeric"
              placeholder="12345-1234567-1"
              className={`${input('cnic').className} font-mono ${f.cnic && !CNIC_PATTERN.test(f.cnic) ? 'border-red-300' : ''}`}
            />
          </Field>
          <Field label="CNIC expiry">
            <input {...input('cnicExpiry')} type="date" />
          </Field>
          <Field label="Date of birth">
            <input {...input('dateOfBirth')} type="date" max={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Gender">
            <Choice
              value={f.gender}
              onChange={(v) => set('gender', v)}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </Field>
          <Field label="Marital status">
            <Choice
              value={f.maritalStatus}
              onChange={(v) => set('maritalStatus', v)}
              options={[
                { value: 'single', label: 'Single' },
                { value: 'married', label: 'Married' },
                { value: 'widowed', label: 'Widowed' },
                { value: 'divorced', label: 'Divorced' },
              ]}
            />
          </Field>
        </Section>

        <Section title="Address" icon={<Home className="h-4 w-4" />}>
          <div className="sm:col-span-2">
            <Field label="Home address">
              <input {...input('street')} autoComplete="street-address" placeholder="House, street, area" />
            </Field>
          </div>
          <Field label="City">
            <input {...input('city')} autoComplete="address-level2" placeholder="e.g. Mirpur" />
          </Field>
          <Field label="Province / region">
            <input {...input('state')} placeholder="e.g. AJK, Punjab" />
          </Field>
        </Section>

        <Section title="Education & work" icon={<Briefcase className="h-4 w-4" />}>
          <Field label="Qualification">
            <input {...input('qualification')} placeholder="e.g. Matric, FA, BA" />
          </Field>
          <Field label="Previous employer">
            <input {...input('previousEmployer')} placeholder="optional" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Experience">
              <textarea {...input('experience')} rows={3} placeholder="e.g. 2 years as cashier at a superstore" className={`${input('experience').className} resize-none`} />
            </Field>
          </div>
        </Section>

        <Section title="Emergency contact" icon={<Phone className="h-4 w-4" />} note="Someone we can call if needed.">
          <Field label="Emergency contact name">
            <input {...input('eName')} />
          </Field>
          <Field label="Emergency phone">
            <input {...input('ePhone')} type="tel" inputMode="tel" placeholder="03xx xxxxxxx" />
          </Field>
          <Field label="Relationship">
            <input {...input('eRelation')} placeholder="e.g. Brother, Wife" />
          </Field>
        </Section>

        <Section title="Guarantor / reference" icon={<ShieldCheck className="h-4 w-4" />} note="A person who knows you and can vouch for you.">
          <Field label="Guarantor name">
            <input {...input('gName')} />
          </Field>
          <Field label="Guarantor CNIC">
            <input
              {...input('gCnic')}
              onChange={(e) => set('gCnic', formatCnicInput(e.target.value))}
              inputMode="numeric"
              placeholder="12345-1234567-1"
              className={`${input('gCnic').className} font-mono ${f.gCnic && !CNIC_PATTERN.test(f.gCnic) ? 'border-red-300' : ''}`}
            />
          </Field>
          <Field label="Guarantor phone">
            <input {...input('gPhone')} type="tel" inputMode="tel" placeholder="03xx xxxxxxx" />
          </Field>
          <Field label="Relation">
            <input {...input('gRelation')} placeholder="e.g. Uncle, Neighbour, Former employer" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Guarantor address">
              <input {...input('gAddress')} />
            </Field>
          </div>
        </Section>

        <Section title="Bank account (optional)" icon={<Landmark className="h-4 w-4" />} note="For your salary. You can skip this.">
          <Field label="Account title">
            <input {...input('accountTitle')} />
          </Field>
          <Field label="Bank name">
            <input {...input('bankName')} placeholder="e.g. Meezan Bank, HBL, JazzCash" />
          </Field>
          <Field label="Account number">
            <input {...input('accountNumber')} inputMode="numeric" />
          </Field>
          <Field label="IBAN">
            <input {...input('iban')} placeholder="PK36 MEZN 0000 …" className={`${input('iban').className} font-mono uppercase`} />
          </Field>
        </Section>

        <Section title="Your photo" icon={<Camera className="h-4 w-4" />} note="A clear photo of your face.">
          <div className="sm:col-span-2 flex items-center gap-4">
            <div className="h-24 w-24 flex-shrink-0 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Your photo" className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-gray-300" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
                <Camera className="h-4 w-4" /> Take photo
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
                <ImagePlus className="h-4 w-4" /> Choose from gallery
              </button>
              {photo && (
                <button type="button" onClick={() => setPhoto(null)} className="text-xs text-red-600 text-left">
                  Remove photo
                </button>
              )}
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                pickPhoto(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickPhoto(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </Section>

        <Section title="Documents" icon={<FileText className="h-4 w-4" />} note={`CNIC front and back, CV, certificates. Pictures or PDF, max 4 MB each, up to ${MAX_FILES} files.`}>
          <div className="sm:col-span-2 space-y-2">
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    {isPdfFile(file) ? <FileText className="h-4 w-4 text-red-600 flex-shrink-0" /> : <Paperclip className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-600" aria-label={`Remove ${file.name}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => docsRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-honey-400 hover:text-honey-700"
              >
                <Paperclip className="h-4 w-4" /> Add files
              </button>
            )}
            {fileNote && <p className="text-xs text-red-600">{fileNote}</p>}
            <input
              ref={docsRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                pickDocs(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </Section>

        <div ref={errorRef}>
          <ErrorBox message={error} />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-base font-semibold text-gray-900 bg-honey-500 rounded-xl hover:bg-honey-600 shadow-md disabled:opacity-60"
        >
          {sending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Sending…
            </>
          ) : (
            'Send my form'
          )}
        </button>
        <p className="pb-6 text-center text-xs text-gray-500">Your details are only seen by the shop.</p>
      </form>
    </Shell>
  );
}
