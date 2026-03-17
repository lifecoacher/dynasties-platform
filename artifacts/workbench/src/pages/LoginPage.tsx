import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  useEffect(() => {
    if (autoLoginAttempted) return;
    setAutoLoginAttempted(true);

    const isDev = import.meta.env.DEV;
    const manuallyLoggedOut = localStorage.getItem("dynasties_manual_logout") === "true";
    if (isDev && !manuallyLoggedOut) {
      setIsSubmitting(true);
      login("admin@dynasties.io", "DynastiesAdmin2026!").catch(() => {
        setIsSubmitting(false);
      });
    }
  }, [autoLoginAttempted, login]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
      setIsSubmitting(false);
    }
  };

  if (authLoading || (import.meta.env.DEV && isSubmitting && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <span className="font-heading text-[20px] font-medium text-foreground" style={{ letterSpacing: '0.22em' }}>DYNASTIES</span>
            <div className="absolute -bottom-1.5 left-0 w-[1.3em] h-[2.5px] rounded-full bg-primary" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary mt-4" />
          <p className="text-[13px] text-muted-foreground">Connecting...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm mx-4"
      >
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <span className="font-heading text-[24px] font-medium text-foreground" style={{ letterSpacing: '0.22em' }}>DYNASTIES</span>
            <div className="absolute -bottom-1.5 left-0 w-[1.3em] h-[2.5px] rounded-full bg-primary" />
          </div>
          <p className="text-[14px] text-muted-foreground mt-1">The intelligence layer for global trade</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-card-border bg-card p-6">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[14px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
