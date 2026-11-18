"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Attributes page (colors/sizes) hidden from the admin panel; redirect to the products list. Backend data is untouched.
export default function AttributesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/products");
  }, [router]);
  return null;
}
