// Employees + contract letters API (backend: routes/modules/hrRoutes.js).
import { storeApi, BACKEND_URL, type PageMeta } from '@/lib/storeApi';

export type EmploymentType = 'permanent' | 'contract' | 'probation' | 'part_time' | 'daily_wage';
export type EmployeeStatus = 'active' | 'on_leave' | 'resigned' | 'terminated';
export type DocumentType = 'cnic_front' | 'cnic_back' | 'photo' | 'cv' | 'contract' | 'other';
export type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface EmployeeDocument {
  _id: string;
  type: DocumentType;
  name?: string;
  url: string;
  uploadedAt?: string;
}

export interface ContractIssued {
  _id: string;
  issuedAt: string;
  templateId?: string | null;
  templateName: string;
  startDate?: string | null;
  endDate?: string | null;
  /** Hidden from view-only users. */
  salary?: number;
  designation?: string;
  issuedByName?: string;
  note?: string;
}

export interface Allowance {
  name: string;
  amount: number;
}

/** A role as the API may send it: populated `{ _id, name }`, an id, or a name. */
export type LoginRoleRef = string | { _id?: string; id?: string; name?: string | null } | null;

/** The staff login linked to an employee. */
export interface EmployeeLogin {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  isActive?: boolean;
  role?: LoginRoleRef;
  staffRole?: LoginRoleRef;
}

export interface Employee {
  _id: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  name: string;
  user?: EmployeeLogin | null;
  photo?: string | null;
  phone?: string | null;
  email?: string | null;
  cnic?: string | null;
  cnicExpiry?: string | null;
  fatherHusbandName?: string | null;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  maritalStatus?: 'single' | 'married' | 'widowed' | 'divorced' | null;
  qualification?: string | null;
  experience?: string | null;
  previousEmployer?: string | null;
  address?: { street?: string | null; city?: string | null; state?: string | null; zipCode?: string | null; country?: string | null };
  designation?: string | null;
  position?: string | null;
  department?: string | null;
  employmentType: EmploymentType;
  joiningDate?: string | null;
  hireDate?: string | null;
  probationEndDate?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  shift?: { start?: string | null; end?: string | null };
  weeklyOff?: Day[];
  salary?: number;
  salaryBreakdown?: { basic: number; allowances: Allowance[] };
  salaryPayDay?: number;
  salaryPaymentMethod?: 'cash' | 'bank_transfer' | 'cheque';
  bankDetails?: { accountTitle?: string | null; accountNumber?: string | null; bankName?: string | null; iban?: string | null };
  guarantor?: { name?: string | null; cnic?: string | null; phone?: string | null; relation?: string | null; address?: string | null };
  emergencyContact?: { name?: string | null; phone?: string | null; relationship?: string | null };
  documents: EmployeeDocument[];
  status: EmployeeStatus;
  exitDate?: string | null;
  exitReason?: string | null;
  contractsIssued: ContractIssued[];
  history?: { at: string; action: string; note?: string }[];
  notes?: string | null;
  isActive: boolean;
  /** true when salary / bank / CNIC were removed (view-only user). */
  sensitiveHidden: boolean;
  linkedLoginStillActive?: boolean;
  createdAt?: string;
}

export type EmployeePayload = Partial<
  Omit<Employee, '_id' | 'name' | 'user' | 'documents' | 'contractsIssued' | 'history' | 'sensitiveHidden' | 'employeeCode'>
> & { user?: string | null };

export interface CreateLoginPayload {
  email: string;
  password: string;
  roleId: string;
}

export interface EmployeeListMeta extends PageMeta {
  departments?: string[];
  canSeeSensitive?: boolean;
}

export interface ContractTemplate {
  _id: string;
  name: string;
  body: string;
  isDefault: boolean;
  builtin?: boolean;
  updatedAt?: string;
}

export interface Placeholder {
  key: string;
  label: string;
}

export interface ContractRender {
  html: string;
  template: { _id: string; name: string; builtin: boolean };
  letterhead: {
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    logoUrl: string;
  };
  employee: { _id: string; name: string; employeeCode?: string };
  missing: Placeholder[];
  unknown: string[];
}

export const STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: 'Active',
  on_leave: 'On leave',
  resigned: 'Resigned',
  terminated: 'Terminated',
};

export const STATUS_STYLE: Record<EmployeeStatus, string> = {
  active: 'bg-green-100 text-green-700',
  on_leave: 'bg-amber-100 text-amber-700',
  resigned: 'bg-gray-200 text-gray-700',
  terminated: 'bg-red-100 text-red-700',
};

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  permanent: 'Permanent',
  contract: 'Contract',
  probation: 'Probation',
  part_time: 'Part time',
  daily_wage: 'Daily wage',
};

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  cnic_front: 'CNIC front',
  cnic_back: 'CNIC back',
  photo: 'Photo',
  cv: 'CV',
  contract: 'Signed contract',
  other: 'Other',
};

export const DAYS: { key: Day; label: string }[] = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

/** Uploaded files are served by the backend (`/uploads/...`) or Vercel Blob (full URL). */
export const fileUrl = (url?: string | null) => (!url ? '' : /^https?:\/\//.test(url) ? url : `${BACKEND_URL}${url}`);

/** "12345-1234567-1" while typing 13 digits. */
export function formatCnicInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}
export const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;

/** 'YYYY-MM-DD' for <input type="date"> */
export const dateInput = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : '');

export const employeeApi = {
  list: (params: Record<string, string | number | undefined>) => storeApi.get<Employee[]>('/employees', params),
  get: async (id: string) => (await storeApi.get<Employee>(`/employees/${id}`)).data,
  create: async (body: EmployeePayload) => (await storeApi.post<Employee>('/employees', body)).data,
  update: async (id: string, body: EmployeePayload) => (await storeApi.put<Employee>(`/employees/${id}`, body)).data,
  setStatus: async (id: string, body: { status: EmployeeStatus; date?: string; reason?: string }) =>
    (await storeApi.post<Employee>(`/employees/${id}/status`, body)).data,
  remove: (id: string) => storeApi.del(`/employees/${id}`),
  uploadPhoto: async (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return (await storeApi.upload<Employee>(`/employees/${id}/photo`, form)).data;
  },
  uploadDocuments: async (id: string, type: DocumentType, files: File[], name?: string) => {
    const form = new FormData();
    form.append('type', type);
    if (name) form.append('name', name);
    files.forEach((f) => form.append('files', f));
    return (await storeApi.upload<Employee>(`/employees/${id}/documents`, form)).data;
  },
  removeDocument: async (id: string, docId: string) => (await storeApi.del<Employee>(`/employees/${id}/documents/${docId}`)).data,
  linkableUsers: async (search: string, employeeId?: string) =>
    (await storeApi.get<{ _id: string; name: string; email: string }[]>('/employees/linkable-users', { search, employeeId })).data,
  /** New staff login for this employee (needs staff create + employees edit). 409 = already has one / e-mail taken. */
  createLogin: async (id: string, body: CreateLoginPayload) => (await storeApi.post<Employee>(`/employees/${id}/login`, body)).data,
  /** Removes the link between the employee and their login. */
  unlinkLogin: async (id: string) => (await storeApi.del<Employee>(`/employees/${id}/login`)).data,

  contract: async (id: string, templateId?: string) => (await storeApi.get<ContractRender>(`/employees/${id}/contract`, { templateId })).data,
  issueContract: async (id: string, body: { templateId?: string; note?: string }) =>
    (await storeApi.post<{ contractsIssued: ContractIssued[] }>(`/employees/${id}/contract/issue`, body)).data,
  templates: () => storeApi.get<ContractTemplate[]>('/contract-templates', { limit: 200 }),
  createTemplate: async (body: { name: string; body: string; isDefault?: boolean }) =>
    (await storeApi.post<ContractTemplate>('/contract-templates', body)).data,
  updateTemplate: async (id: string, body: { name?: string; body?: string; isDefault?: boolean }) =>
    (await storeApi.put<ContractTemplate>(`/contract-templates/${id}`, body)).data,
  removeTemplate: (id: string) => storeApi.del(`/contract-templates/${id}`),
};
