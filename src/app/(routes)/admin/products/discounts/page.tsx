"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Discount Rules page hidden from the admin panel; redirect to the products list. Backend data is untouched.
export default function DiscountRulesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/products");
  }, [router]);
  return null;
}
