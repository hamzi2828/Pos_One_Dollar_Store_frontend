// The Employee Portal's own address (owner 2026-11-19): employee.dollarandco.org.
// There only the portal and its email-code sign-in are shown — no POS / staff login,
// no admin panel. middleware.ts enforces the same on the server side.
export const PORTAL_HOST_PREFIX = 'employee.';

/** True in the browser when the page is open on the employee address. */
export function isPortalHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.toLowerCase().startsWith(PORTAL_HOST_PREFIX);
}
