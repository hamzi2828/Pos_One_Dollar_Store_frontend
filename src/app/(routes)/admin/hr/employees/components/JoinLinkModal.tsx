'use client';

// "Join link" modal: the public form link the owner sends to people (WhatsApp).
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Link2, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { ErrorBox, Modal, Toggle, inputClass, primaryBtn, secondaryBtn } from '@/components/admin/FormBits';
import { apiErrorMessage } from '@/lib/storeApi';
import { joinAdminApi, type JoinLink } from '../services/joinApi';

export default function JoinLinkModal({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState<JoinLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    joinAdminApi
      .link()
      .then(setLink)
      .catch((e) => setError(apiErrorMessage(e, 'Could not load the join link.')))
      .finally(() => setLoading(false));
  }, []);

  const url = link?.token && typeof window !== 'undefined' ? `${window.location.origin}/join/${link.token}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy it.');
    }
  };

  const run = async (fn: () => Promise<JoinLink>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      setLink(await fn());
      if (done) toast.success(done);
      return true;
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save. Try again.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Fill this form to join DOLLAR & Co: ${url}`)}`;

  return (
    <Modal
      title="Join link"
      subtitle="Send it to people who want to work here"
      icon={<Link2 className="h-5 w-5" />}
      onClose={onClose}
      busy={busy}
      footer={
        <button type="button" onClick={onClose} className={secondaryBtn} disabled={busy}>
          Close
        </button>
      }
    >
      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-honey-700 mx-auto" />
        </div>
      ) : (
        <div className="space-y-4">
          <ErrorBox message={error} />
          {link && (
            <>
              <p className="text-sm text-gray-600">
                People open this link on their phone, fill in their details, photo and documents, and send. You see them under{' '}
                <span className="font-medium">Applications</span> and approve or reject.
              </p>
              <div className="flex gap-2">
                <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-xs ${link.enabled ? '' : 'opacity-50'}`} aria-label="Join link" />
                <button type="button" onClick={copy} className={primaryBtn} disabled={!url}>
                  <Copy className="h-4 w-4" /> Copy
                </button>
              </div>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" /> Share on WhatsApp
              </a>
              <div className="rounded-lg border border-gray-200 p-3">
                <Toggle
                  checked={link.enabled}
                  disabled={busy}
                  onChange={(v) => run(() => joinAdminApi.setEnabled(v), v ? 'Link is on' : 'Link is off')}
                  label={link.enabled ? 'Link is on' : 'Link is off'}
                  hint={link.enabled ? 'Anyone with the link can send a form.' : 'The link shows "not working" until you turn it on.'}
                />
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                {confirmNew ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-800">Make a new link? The old link will stop working.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (await run(() => joinAdminApi.regenerate(), 'New link made')) setConfirmNew(false);
                        }}
                        className={primaryBtn}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Yes, make a new link
                      </button>
                      <button type="button" disabled={busy} onClick={() => setConfirmNew(false)} className={secondaryBtn}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">Shared the link with the wrong person? Make a new one.</p>
                    <button type="button" onClick={() => setConfirmNew(true)} className={secondaryBtn} disabled={busy}>
                      <RefreshCw className="h-4 w-4" /> Make a new link
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
