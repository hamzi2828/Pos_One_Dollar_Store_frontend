// app/not-found.tsx
import Link from "next/link";
export default function NotFound() {
    return (
      <main className="min-h-[50vh] flex items-center justify-center px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Page not found</h1>
          <p className="mt-2 text-gray-600">The page you’re looking for doesn’t exist.</p>
          <Link href="/" className="mt-6 inline-block underline font-medium">
            Go back home
          </Link>
        </div>
      </main>
    );
  }
  