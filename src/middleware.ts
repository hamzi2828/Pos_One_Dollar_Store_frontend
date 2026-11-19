import { NextRequest, NextResponse } from 'next/server';

// Runs on the server before every page. MUST live in src/ (the app uses src/app):
// Next.js ignores a middleware.ts at the project root, so the old root file never ran.
//
// It only handles the Employee Portal's own address (owner 2026-11-19):
// employee.dollarandco.org shows ONLY the portal and its email-code sign-in.
// pos.dollarandco.org is left exactly as before (sign-in / admin checks happen in
// the pages themselves, as they always did).
const PORTAL_HOST_PREFIX = 'employee.';
const MAIN_SITE = 'https://pos.dollarandco.org';

/** The address the visitor typed (behind Coolify's proxy req.nextUrl has the internal one). */
function visitorHost(req: NextRequest) {
  return (req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host || '').split(',')[0].trim().toLowerCase();
}

export function middleware(req: NextRequest) {
  const host = visitorHost(req);
  if (!host.startsWith(PORTAL_HOST_PREFIX)) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isPortal = pathname === '/portal' || pathname.startsWith('/portal/');
  const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  const here = (path: string) => NextResponse.redirect(`${proto}://${host}${path}`);

  // Sign-in page: always the employee sign-in (next must be a /portal page), never the POS login.
  if (pathname === '/authentication') {
    const nextParam = req.nextUrl.searchParams.get('next') || '';
    if (nextParam.startsWith('/portal')) return NextResponse.next();
    return here('/authentication?next=%2Fportal');
  }
  // The admin panel (and the POS inside it) stays on the main address.
  if (isAdmin) return NextResponse.redirect(`${MAIN_SITE}${pathname}${search}`);
  // The portal pages themselves (they send a signed-out visitor to the sign-in).
  if (isPortal) return NextResponse.next();
  // Home page and every other page -> the portal.
  return here('/portal');
}

export const config = {
  // Every page, not Next.js files, /build-id (the app's new-version check) or static files (.png, .js ...).
  matcher: ['/((?!_next/|build-id|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)'],
};
