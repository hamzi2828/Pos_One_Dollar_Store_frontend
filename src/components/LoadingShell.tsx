// First paint while the app's JavaScript loads. The admin pages (the POS
// too) are drawn in the browser, so without this the server HTML is an empty
// white page until every script has arrived — minutes on a bad connection.
// Plain HTML + inline CSS (no JavaScript needed to show it, no hooks, so it
// can be used from server and client components); after 8 s it also says the
// connection is slow so the cashier waits instead of closing the page.
const css = `
.app-shell{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#f3f4f6;color:#111827;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;padding:16px}
.app-shell b{font-size:20px;letter-spacing:.04em}
.app-shell i{width:34px;height:34px;border:4px solid #d1d5db;border-top-color:#111827;border-radius:50%;animation:app-shell-spin .8s linear infinite}
.app-shell small{font-size:14px;color:#4b5563}
.app-shell .app-shell-slow{opacity:0;max-width:340px;animation:app-shell-show 0s 8s forwards}
@keyframes app-shell-spin{to{transform:rotate(360deg)}}
@keyframes app-shell-show{to{opacity:1}}
`;

export default function LoadingShell() {
  return (
    <div className="app-shell" role="status" aria-live="polite">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <b>DOLLAR &amp; Co</b>
      <i aria-hidden="true" />
      <small>Loading…</small>
      <small className="app-shell-slow">The internet is slow — still loading. Please wait, do not close this page.</small>
    </div>
  );
}
