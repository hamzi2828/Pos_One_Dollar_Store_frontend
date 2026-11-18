"use client";

// Moved to Finance (owner, 2026-11-17): /admin/financial-statements.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MovedFinancialStatements() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/financial-statements${window.location.hash}`);
  }, [router]);
  return null;
}
