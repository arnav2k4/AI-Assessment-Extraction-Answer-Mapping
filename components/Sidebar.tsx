"use client";

import {
  BookOpen,
  ClipboardCheck,
  FolderClock,
  Home,
  MessageSquare,
  School,
  Settings,
  Sparkles,
} from "lucide-react";

const navItems = [
  { label: "Home", icon: Home },
  { label: "My Classroom", icon: MessageSquare },
  { label: "Assignments", icon: BookOpen },
  { label: "Exams", icon: ClipboardCheck, active: true },
  { label: "My Library", icon: FolderClock },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-4 lg:flex">
      {/* Logo */}

      <div className="mb-5 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
          <Sparkles size={16} />
        </div>

        <span className="text-base font-bold text-gray-900">VedaAI</span>
      </div>

      {/* AI Teacher's Toolkit */}

      <button
        type="button"
        className="mb-6 flex items-center justify-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        <Sparkles size={15} />
        AI Teacher&rsquo;s Toolkit
      </button>

      {/* Nav */}

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                item.active
                  ? "bg-gray-100 font-medium text-gray-900"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Settings */}

      <button
        type="button"
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-600 transition hover:bg-gray-50"
      >
        <Settings size={17} />
        Settings
      </button>

      {/* School card */}

      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
          <School size={16} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            Delhi Public School
          </p>

          <p className="truncate text-xs text-gray-500">
            Bokaro Steel City
          </p>
        </div>
      </div>
    </aside>
  );
}
