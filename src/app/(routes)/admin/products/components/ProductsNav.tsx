"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/admin/products", label: "All Products" },
  { href: "/admin/products/categories", label: "Categories" },
  { href: "/admin/products/attributes", label: "Attributes" },
  { href: "/admin/products/create", label: "Create Product" },
];

export default function ProductsNav() {
  const pathname = usePathname();

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <nav className="flex -mb-px" aria-label="Tabs">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href === "/admin/products" && pathname === "/admin/products") ||
            (item.href !== "/admin/products" && pathname.startsWith(item.href));

          // Special case: /admin/products should only be active for exact match
          const isExactActive = item.href === "/admin/products"
            ? pathname === "/admin/products"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex-1 py-2.5 sm:py-3 md:py-4 px-3 sm:px-4 md:px-6 text-center border-b-2 font-medium text-xs sm:text-sm focus:outline-none " +
                (isExactActive
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
