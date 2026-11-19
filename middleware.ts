import { NextRequest, NextResponse } from 'next/server';

// Employee Portal on its own address (owner 2026-11-19): employee.dollarandco.org
// opens only the portal; the admin panel stays on the main POS address.
const PORTAL_HOST_PREFIX = 'employee.';
const MAIN_SITE = 'https://pos.dollarandco.org';

function portalHost(req: NextRequest) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  return host.startsWith(PORTAL_HOST_PREFIX);
}

// Protect routes that require authentication
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isPortal = pathname === '/portal' || pathname.startsWith('/portal/');

  if (portalHost(req)) {
    // Only the portal and its sign-in live on this address.
    if (pathname === '/authentication') {
      // Always the employee sign-in (next must be a /portal page), never the POS login.
      const nextParam = req.nextUrl.searchParams.get('next') || '';
      if (!nextParam.startsWith('/portal')) {
        const url = req.nextUrl.clone();
        url.search = '';
        url.searchParams.set('next', '/portal');
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
    // The admin panel (and the POS inside it) stays on the main address.
    if (isAdmin) return NextResponse.redirect(`${MAIN_SITE}${pathname}${search}`);
    // Home page and every other page -> the portal.
    if (!isPortal) {
      const url = req.nextUrl.clone();
      url.pathname = '/portal';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  if (!isAdmin && !isPortal) return NextResponse.next();

  const token = req.cookies.get('auth_token')?.value;
  const role = req.cookies.get('auth_role')?.value;

  // Employee Portal: any signed-in login (no admin role / permission needed).
  // The server finds the employee linked to the login, or answers 404.
  if (isPortal) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/authentication';
      url.search = '';
      url.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Admin requires authentication + admin role. There is no public site to
  // fall back to, so a non-admin is sent to the login page rather than '/'.
  if (!token || role !== 'admin') {
    const url = req.nextUrl.clone();
    url.pathname = '/authentication';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Every page (not Next.js files or static files like .png / .js): on the portal
  // address any page other than the portal is redirected. On the main address only
  // /admin and /portal are checked, as before.
  // /build-id is the app's "is there a new version" check (src/app/build-id/route.ts).
  matcher: ['/((?!_next/|build-id|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)'],
};
