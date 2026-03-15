import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, User, Building2, Shield, Bell, LogOut, Copy, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    if (user?.companyId) {
      navigator.clipboard.writeText(user.companyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AppLayout hideRightPanel>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Manage your account and organization</p>
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-xl bg-card border border-card-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-primary" />
              <h2 className="text-[14px] font-semibold text-foreground">Profile</h2>
            </div>
            <div className="space-y-3">
              <SettingsField label="Name" value={user?.name || "—"} />
              <SettingsField label="Email" value={user?.email || "—"} />
              <SettingsField label="Role" value={user?.role || "—"} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-xl bg-card border border-card-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="text-[14px] font-semibold text-foreground">Organization</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Organization ID</p>
                  <p className="text-[13px] text-foreground font-mono">{user?.companyId?.slice(0, 16)}...</p>
                </div>
                <button
                  onClick={handleCopyId}
                  className="p-2 rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-xl bg-card border border-card-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-primary" />
              <h2 className="text-[14px] font-semibold text-foreground">Security</h2>
            </div>
            <p className="text-[13px] text-muted-foreground mb-4">
              Session management and security controls.
            </p>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-[13px] font-medium hover:bg-destructive/20 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}

function SettingsField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[13px] text-foreground">{value}</p>
    </div>
  );
}
