// Public "join" link + employee applications (people fill a form from a link
// the owner shares; the owner approves to create the employee).
import axios from 'axios';
import { storeApi, API_URL } from '@/lib/storeApi';
import type { Employee, EmploymentType } from './employeeApi';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type PayType = 'monthly' | 'daily';

export interface JoinLink {
  token: string;
  enabled: boolean;
  /** Links that still work (every open makes a new one; old ones keep working). */
  activeLinks?: number;
}

export interface ApplicationFile {
  url: string;
  name?: string;
  type?: string;
}

/** The person's own details (same shape for the public form and the application). */
export interface ApplicantDetails {
  firstName: string;
  lastName?: string | null;
  fatherHusbandName?: string | null;
  phone: string;
  email?: string | null;
  cnic?: string | null;
  cnicExpiry?: string | null;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  maritalStatus?: Employee['maritalStatus'];
  qualification?: string | null;
  experience?: string | null;
  previousEmployer?: string | null;
  address?: Employee['address'];
  emergencyContact?: Employee['emergencyContact'];
  guarantor?: Employee['guarantor'];
  bankDetails?: Employee['bankDetails'];
}

export interface EmployeeApplication extends ApplicantDetails {
  _id: string;
  reference: string;
  status: ApplicationStatus;
  submittedAt: string;
  name: string;
  photo?: string | null;
  files: ApplicationFile[];
  reviewedAt?: string | null;
  reviewedByName?: string | null;
  rejectReason?: string | null;
  /** Set when the person changed their own form from the join link. */
  updatedBySubmitterAt?: string | null;
  submitterEdits?: number;
  /** Employee made on approval (id or populated). */
  employee?: string | { _id: string; name?: string } | null;
}

export interface ApplicationListMeta {
  total: number;
  page: number;
  limit: number;
  pages?: number;
  counts: Record<ApplicationStatus, number>;
}

export interface ApprovePayload {
  designation?: string;
  department?: string;
  joiningDate?: string;
  salary?: number;
  payType?: PayType;
  employmentType?: EmploymentType;
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const APPLICATION_STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export const employeeIdOf = (a: Pick<EmployeeApplication, 'employee'>): string | null =>
  !a.employee ? null : typeof a.employee === 'string' ? a.employee : a.employee._id || null;

/** Admin side (logged in). */
export const joinAdminApi = {
  link: async () => (await storeApi.get<JoinLink>('/employee-join-link')).data,
  /** A new link; older links keep working unless `blockOld`. */
  regenerate: async (blockOld = false) => (await storeApi.post<JoinLink>('/employee-join-link/regenerate', blockOld ? { blockOld: true } : {})).data,
  setEnabled: async (enabled: boolean) => (await storeApi.put<JoinLink>('/employee-join-link', { enabled })).data,

  applications: (params: { status: ApplicationStatus | 'all'; page: number; limit: number }) =>
    storeApi.get<EmployeeApplication[]>('/employee-applications', params),
  application: async (id: string) => (await storeApi.get<EmployeeApplication>(`/employee-applications/${id}`)).data,
  approve: async (id: string, body: ApprovePayload) =>
    (await storeApi.post<{ application: EmployeeApplication; employeeId: string }>(`/employee-applications/${id}/approve`, body)).data,
  reject: async (id: string, reason: string) =>
    (await storeApi.post<EmployeeApplication>(`/employee-applications/${id}/reject`, { reason })).data,
};

/** The person's own form, as the public page sees it (no review notes). */
export interface MyApplication extends ApplicantDetails {
  reference: string;
  status: ApplicationStatus;
  submittedAt: string;
  updatedAt?: string | null;
  photo?: string | null;
  files: ApplicationFile[];
}

const joinForm = (details: ApplicantDetails, photo: File | null, files: File[], website: string) => {
  const form = new FormData();
  form.append('data', JSON.stringify(details));
  if (photo) form.append('photo', photo);
  files.forEach((f) => form.append('files', f));
  form.append('website', website);
  return form;
};

const mineUrl = (token: string) => `${API_URL}/public/join/${encodeURIComponent(token)}/mine`;

/** Public side (no login): the /join/<token> page. */
export const joinPublicApi = {
  info: async (token: string) =>
    (await axios.get<{ success: boolean; data: { shopName: string; open: boolean } }>(`${API_URL}/public/join/${encodeURIComponent(token)}`)).data.data,
  submit: async (token: string, details: ApplicantDetails, photo: File | null, files: File[], website: string) => {
    const res = await axios.post<{ success: boolean; data: { reference: string; editKey?: string } }>(
      `${API_URL}/public/join/${encodeURIComponent(token)}`,
      joinForm(details, photo, files, website),
    );
    return res.data.data;
  },
  /** The form this person sent before (`editKey` from submit). 404 when the key is not known. */
  mine: async (token: string, editKey: string) =>
    (await axios.get<{ success: boolean; data: MyApplication }>(mineUrl(token), { headers: { 'x-join-key': editKey } })).data.data,
  /** Change it while pending (409 once approved or rejected). New photo / files replace the old ones. */
  updateMine: async (token: string, editKey: string, details: ApplicantDetails, photo: File | null, files: File[], website: string) =>
    (
      await axios.put<{ success: boolean; data: MyApplication }>(mineUrl(token), joinForm(details, photo, files, website), {
        headers: { 'x-join-key': editKey },
      })
    ).data.data,
};
