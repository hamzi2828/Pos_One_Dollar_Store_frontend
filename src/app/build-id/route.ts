// Which deploy is live. The POS compares it with the build it is running and
// reloads itself (when the cart is empty) so counters never keep old code.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { id: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
