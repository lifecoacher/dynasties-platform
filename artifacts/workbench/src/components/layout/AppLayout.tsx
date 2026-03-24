import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { DEMO_MODE } from "@/hooks/use-demo";

interface AppLayoutProps {
  children: ReactNode;
  hideRightPanel?: boolean;
}

export function AppLayout({ children, hideRightPanel = false }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {DEMO_MODE && (
          <div className="shrink-0 px-4 py-1 bg-primary/6 border-b border-primary/10 text-center">
            <span className="text-[10px] font-medium text-primary/60 tracking-wider uppercase">
              Demo Mode
            </span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      {!hideRightPanel && <RightPanel />}
    </div>
  );
}
