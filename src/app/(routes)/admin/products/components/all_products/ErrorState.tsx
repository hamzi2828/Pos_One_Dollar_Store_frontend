"use client";
import React from "react";
import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  error: string;
}

export default function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 md:p-6">
      <div className="rounded-lg sm:rounded-xl bg-red-50 border border-red-200 p-3 sm:p-4 md:p-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-medium text-red-800">Error loading products</h3>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
