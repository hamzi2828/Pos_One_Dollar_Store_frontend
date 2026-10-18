import type { AccessInfo } from '@/helper/access';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  data: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'user' | 'admin' | 'moderator';
  };
  /** Role + permissions of a staff login (see helper/access.ts). */
  access?: AccessInfo;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = 'Login failed';
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}
