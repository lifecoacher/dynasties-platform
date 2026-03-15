import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";

export default function NotFound() {
  return (
    <AppLayout hideRightPanel>
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-6xl font-semibold text-foreground/20 mb-2">404</h1>
          <p className="text-[14px] text-muted-foreground mb-4">Page not found</p>
          <Link href="/" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
            Back to Command Center
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
