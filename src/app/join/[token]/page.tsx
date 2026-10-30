// Public "join DOLLAR & Co" form. No login: the owner shares this link (e.g. on WhatsApp).
import type { Metadata } from 'next';
import JoinForm from './JoinForm';

export const metadata: Metadata = {
  title: 'Join DOLLAR & Co',
  description: 'Apply to work at DOLLAR & Co.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinForm token={token} />;
}
