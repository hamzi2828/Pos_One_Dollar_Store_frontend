"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccess } from "@/context/AccessContext";

interface NavItem {
  href: string;
  label: string;
  /** Permission needed to see the tab (view). */
  perm?: string;
}

const navItems: NavItem[] = [
  { href: "/admin/products", label: "All Products" },
  { href: "/admin/products/categories", label: "Categories" },
  { href: "/admin/products/attributes", label: "Attributes" },
  { href: "/admin/products/price-tiers", label: "Price Tiers", perm: "price_tiers" },
  { href: "/admin/products/discounts", label: "Discounts", perm: "discounts" },
  { href: "/admin/products/create", label: "Create Product" },
];

export default function ProductsNav() {
  const pathname = usePathname();
  const { can } = useAccess();
  const items = navItems.filter((item) => !item.perm || can(item.perm, "view"));

  return (
    <div className="bg-white shadow sm:rounded-lg overflow-x-auto">
      <nav className="flex -mb-px min-w-max sm:min-w-0" aria-label="Tabs">
        {items.map((item) => {
          // /admin/products is only active on an exact match; the others for their sub-pages too.
          const isActive = item.href === "/admin/products" ? pathname === "/admin/products" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex-1 py-2.5 sm:py-3 md:py-4 px-3 sm:px-4 md:px-6 text-center border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap focus:outline-none " +
                (isActive
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
