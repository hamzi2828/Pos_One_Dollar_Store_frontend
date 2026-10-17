"use client";
import React from "react";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  additionalInfo?: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  return (
    <div className="bg-white shadow sm:rounded-lg">
      <nav className="flex -mb-px" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={
                "w-1/3 py-2.5 sm:py-3 md:py-4 px-3 sm:px-4 md:px-6 text-center border-b-2 font-medium text-xs sm:text-sm focus:outline-none " +
                (isActive
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300")
              }
            >
              <div className="flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-2">
                  {tab.label}
                  {typeof tab.count === "number" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {tab.count}
                    </span>
                  )}
                </span>
                {tab.additionalInfo && (
                  <span className="text-xs text-gray-400 font-normal">
                    {tab.additionalInfo}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
