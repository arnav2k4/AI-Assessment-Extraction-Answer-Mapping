"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({
  breadcrumb,
  onBack,
  children,
}: {
  breadcrumb: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#f5f5f7]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar breadcrumb={breadcrumb} onBack={onBack} />

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
