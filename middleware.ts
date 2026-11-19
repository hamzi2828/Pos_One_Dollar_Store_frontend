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
    // Home page -> the portal.
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/portal';
      url.search = '';
      return NextResponse.redirect(url);
    }
    // Sign-in page on the portal address always signs in to the portal.
    if (pathname === '/authentication' && !req.nextUrl.searchParams.get('next')) {
      const url = req.nextUrl.clone();
      url.searchParams.set('next', '/portal');
      return NextResponse.redirect(url);
    }
    // The admin panel is not on this address.
    if (isAdmin) return NextResponse.redirect(`${MAIN_SITE}${pathname}${search}`);
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
  // '/' and '/authentication' only matter on the portal address (see portalHost).
  matcher: ['/', '/authentication', '/admin', '/admin/:path*', '/portal', '/portal/:path*'],
};
