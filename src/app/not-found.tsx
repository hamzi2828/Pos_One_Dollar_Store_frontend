import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-ink px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <Wordmark className="text-3xl sm:text-4xl" />
        <p className="mt-8 text-5xl font-black text-white/90">404</p>
        <h1 className="mt-2 text-lg font-semibold text-white">Page not found</h1>
        <p className="mt-1 text-sm text-white/60">This page doesn&apos;t exist or was moved.</p>
        <Link
          href="/admin"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-yellow px-5 py-2.5 text-sm font-bold text-brand-ink transition-colors hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-ink"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
