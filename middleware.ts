import { NextRequest, NextResponse } from 'next/server';

// Protect routes that require authentication
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (!isAdmin) return NextResponse.next();

  const token = req.cookies.get('auth_token')?.value;
  const role = req.cookies.get('auth_role')?.value;

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
  matcher: ['/admin', '/admin/:path*'],
};
