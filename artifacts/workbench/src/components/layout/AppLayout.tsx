import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";

interface AppLayoutProps {
  children: ReactNode;
  hideRightPanel?: boolean;
}

export function AppLayout({ children, hideRightPanel = false }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      {!hideRightPanel && <RightPanel />}
    </div>
  );
}
