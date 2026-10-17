"use client";
import React from "react";
import { Loader2 } from "lucide-react";

export default function LoadingState() {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-6 sm:p-8 md:p-12">
      <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-gray-400" />
        <p className="text-xs sm:text-sm text-gray-500">Loading products...</p>
      </div>
    </div>
  );
}
