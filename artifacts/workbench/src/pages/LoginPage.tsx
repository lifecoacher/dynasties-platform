import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, ArrowLeft, Building2, AlertTriangle } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  useEffect(() => {
    if (autoLoginAttempted) return;
    setAutoLoginAttempted(true);
  }, [autoLoginAttempted]);

  const handleLogin = async (e: React.FormEvent) => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${baseUrl}api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          industry: industry || undefined,
          country: country || undefined,
          name,
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        setIsSubmitting(false);
        return;
      }
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Registration failed");
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
  };

  if (authLoading) {
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

        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleLogin}
              className="space-y-4 rounded-2xl border border-card-border bg-card p-6"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)' }}
            >
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

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

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="text-[13px] text-muted-foreground hover:text-primary transition-colors"
                >
                  New to Dynasties? <span className="text-primary font-medium">Create an account</span>
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleRegister}
              className="space-y-3 rounded-2xl border border-card-border bg-card p-6"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-[15px] font-medium text-foreground">Create your workspace</h2>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Organization Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-card-border bg-background pl-9 pr-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
                    placeholder="Acme Freight Forwarding"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    Industry
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  >
                    <option value="">Select...</option>
                    <option value="freight_forwarding">Freight Forwarding</option>
                    <option value="customs_brokerage">Customs Brokerage</option>
                    <option value="nvocc">NVOCC</option>
                    <option value="3pl">3PL</option>
                    <option value="shipping_line">Shipping Line</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
                    placeholder="US"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
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
                <label className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-[14px] outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  placeholder="Min 8 characters"
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
                    Creating workspace...
                  </>
                ) : (
                  <>
                    Create Workspace
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-[13px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Already have an account? <span className="text-primary font-medium">Sign in</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
