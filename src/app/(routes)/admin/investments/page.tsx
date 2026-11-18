'use client';

// Investments moved into Financial Statements as its first tab (owner, 2026-11-17).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MovedInvestments() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/financial-statements#investments');
  }, [router]);
  return null;
}
