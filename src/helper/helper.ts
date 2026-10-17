// src/helper/helper.ts

// JWT payload base fields
export interface JwtBasePayload {
    iat?: number;
    exp?: number;
  }
  
  // Payload we issued from the backend
  export interface UserPayload extends JwtBasePayload {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }
  
  const TOKEN_KEY = 'auth_token';
  const ROLE_KEY = 'auth_role';
  
  function base64UrlDecode(input: string): string {
    // base64url -> base64
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    // pad with =
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    const b64Padded = b64 + '='.repeat(pad);
    if (typeof window === 'undefined') {
      // SSR-safe
      return Buffer.from(b64Padded, 'base64').toString('utf8');
    }
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(b64Padded), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  }
  
  export function decodeJwt<T = unknown>(token: string): T | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payloadJson = base64UrlDecode(parts[1]);
      return JSON.parse(payloadJson) as T;
    } catch {
      return null;
    }
  }
  
  export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }
  
  export function getUserFromToken(token: string): UserPayload | null {
    const payload = decodeJwt<UserPayload>(token);
    if (!payload) return null;
    // Check expiration if present
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;
    // Minimal shape validation
    if (!payload.id || !payload.email) return null;
    return payload;
  }
  
  export function getCurrentUser(): UserPayload | null {
    const token = getAuthToken();
    if (!token) return null;
    return getUserFromToken(token);
  }
  
  export function isAuthenticated(): boolean {
    return !!getCurrentUser();
  }
  
  export function getAuthHeader(): Record<string, string> {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Set token in localStorage and cookie so middleware can read it
  export function setToken(token: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
    try {
      document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; samesite=lax`;
    } catch {}
  }

  // Remove backend token from localStorage and cookie
  export function removeToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    try {
      document.cookie = `${TOKEN_KEY}=; Max-Age=0; path=/; samesite=lax`;
      document.cookie = `${ROLE_KEY}=; Max-Age=0; path=/; samesite=lax`;
    } catch {}
  }

  // Full logout: clear backend tokens + Stack Auth session cookies
  export function clearAllAuth() {
    removeToken();
    try {
      document.cookie.split(';').forEach((c) => {
        const name = c.trim().split('=')[0];
        if (name.startsWith('stack-') || name.startsWith('x-stack-')) {
          document.cookie = `${name}=; Max-Age=0; path=/; samesite=lax`;
        }
      });
    } catch {}
  }

  // Fetch with Authorization header when token is present
  export async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const token = getAuthToken();
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }

  // Role helpers for admin gating in frontend and middleware
  export type UserRole = 'user' | 'admin' | 'moderator';

  export function getRole(): UserRole | null {
    if (typeof window === 'undefined') return null;
    const role = localStorage.getItem(ROLE_KEY) as UserRole | null;
    return role ?? null;
  }

  export function setRole(role: UserRole) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ROLE_KEY, role);
    try {
      document.cookie = `${ROLE_KEY}=${encodeURIComponent(role)}; path=/; samesite=lax`;
    } catch {}
  }

  export function removeRole() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ROLE_KEY);
    try {
      document.cookie = `${ROLE_KEY}=; Max-Age=0; path=/; samesite=lax`;
    } catch {}
  }