"use client";

import { ArrowLeft, Bell, ChevronDown, FileText, HelpCircle, Sparkles } from "lucide-react";

export default function TopBar({
  breadcrumb,
  onBack,
}: {
  breadcrumb: string;
  onBack?: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ArrowLeft size={17} />
        </button>

        <FileText size={15} />

        <span>{breadcrumb}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Help"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
        >
          <HelpCircle size={18} />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
        >
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>

        <button
          type="button"
          aria-label="AI Toolkit"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
        >
          <Sparkles size={18} />
        </button>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm transition hover:bg-gray-100"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
            MR
          </div>

          <span className="font-medium text-gray-900">Teacher</span>

          <ChevronDown size={14} className="text-gray-400" />
        </button>
      </div>
    </header>
  );
}
