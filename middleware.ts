import { NextRequest, NextResponse } from 'next/server';

// Protect routes that require authentication
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isPortal = pathname === '/portal' || pathname.startsWith('/portal/');
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
  matcher: ['/admin', '/admin/:path*', '/portal', '/portal/:path*'],
};
