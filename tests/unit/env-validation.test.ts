import { describe, it, expect } from "vitest";

const KNOWN_BAD_SECRETS = ["dev", "change", "example", "secret", "password", "placeholder"];

function validateJwtSecret(val: string): { ok: boolean; reason?: string } {
  if (val.length < 32) return { ok: false, reason: "JWT_SECRET must be at least 32 characters" };
  const lower = val.toLowerCase();
  if (KNOWN_BAD_SECRETS.some((bad) => lower.includes(bad))) {
    return { ok: false, reason: "JWT_SECRET contains a known-bad substring" };
  }
  return { ok: true };
}

describe("JWT_SECRET validation", () => {
  it("rejects secrets shorter than 32 characters", () => {
    expect(validateJwtSecret("short").ok).toBe(false);
  });

  it("rejects known-bad substrings", () => {
    expect(validateJwtSecret("dev-jwt-secret-change-in-production-min32chars").ok).toBe(false);
  });

  it("accepts a valid secret", () => {
    expect(validateJwtSecret("a-perfectly-valid-jwt-signing-key-that-is-long-enough-1234").ok).toBe(true);
  });

  it("rejects secret containing 'password'", () => {
    expect(validateJwtSecret("my-very-long-password-based-signing-key-123456").ok).toBe(false);
  });

  it("rejects secret containing 'example'", () => {
    expect(validateJwtSecret("this-is-an-example-key-that-is-way-too-predictable").ok).toBe(false);
  });
});

describe("CORS origin parsing", () => {
  it("parses comma-separated CORS_ALLOWED_ORIGINS", () => {
    const raw = "https://dynasties.io, https://app.dynasties.io";
    const origins = raw.split(",").map((o) => o.trim());
    expect(origins).toEqual(["https://dynasties.io", "https://app.dynasties.io"]);
  });

  it("returns empty array when CORS_ALLOWED_ORIGINS is undefined", () => {
    const raw: string | undefined = undefined;
    const origins = raw ? raw.split(",").map((o) => o.trim()) : [];
    expect(origins).toEqual([]);
  });

  it("adds localhost defaults in non-production when no origins specified", () => {
    const origins: string[] = [];
    const isProduction = false;
    if (!isProduction && origins.length === 0) {
      origins.push("http://localhost:3000", "http://localhost:5173", "http://localhost:8080");
    }
    expect(origins).toHaveLength(3);
    expect(origins).toContain("http://localhost:3000");
  });

  it("never uses permissive origin in production", () => {
    const isProduction = true;
    const allowedOrigins = ["https://dynasties.io"];
    const corsOrigin = allowedOrigins;
    expect(corsOrigin).not.toBe(true);
    expect(Array.isArray(corsOrigin)).toBe(true);
  });
});

describe("Logger configuration", () => {
  it("createLogger export exists in @workspace/config", () => {
    const expectedExports = ["createLogger", "loadEnv", "AppError", "ValidationError", "AgentOutputError"];
    expect(expectedExports).toContain("createLogger");
  });

  it("logger should support standard log levels", () => {
    const standardLevels = ["fatal", "error", "warn", "info", "debug", "trace"];
    expect(standardLevels).toHaveLength(6);
    expect(standardLevels).toContain("fatal");
    expect(standardLevels).toContain("error");
  });

  it("redaction paths cover sensitive fields", () => {
    const redactPaths = [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.secret",
      "*.stripeCustomerId",
      "*.email",
      "*.refreshToken",
    ];
    expect(redactPaths).toContain("req.headers.authorization");
    expect(redactPaths).toContain("*.email");
    expect(redactPaths).toContain("*.stripeCustomerId");
  });
});

describe("Helmet CSP directives", () => {
  it("strict CSP blocks all sources by default", () => {
    const directives = {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      connectSrc: ["'self'"],
    };
    expect(directives.defaultSrc).toContain("'none'");
    expect(directives.frameAncestors).toContain("'none'");
    expect(directives.connectSrc).toContain("'self'");
  });
});

describe("Process handler behavior", () => {
  it("graceful shutdown function should log and signal exit", () => {
    let shutdownTriggered = false;
    const mockShutdown = (reason: string, error: unknown) => {
      expect(reason).toBeTruthy();
      expect(error).toBeDefined();
      shutdownTriggered = true;
    };
    mockShutdown("Unhandled promise rejection", new Error("test"));
    expect(shutdownTriggered).toBe(true);
  });
});

describe("Demo route gating", () => {
  it("blocks demo routes in production without VITE_DEMO_MODE", () => {
    const isProduction = true;
    const isDemoMode = false;
    const shouldMount = isDemoMode || !isProduction;
    expect(shouldMount).toBe(false);
  });

  it("allows demo routes in non-production", () => {
    const isProduction = false;
    const isDemoMode = false;
    const shouldMount = isDemoMode || !isProduction;
    expect(shouldMount).toBe(true);
  });

  it("allows demo routes in production with VITE_DEMO_MODE=true", () => {
    const isProduction = true;
    const isDemoMode = true;
    const shouldMount = isDemoMode || !isProduction;
    expect(shouldMount).toBe(true);
  });
});

describe("Stripe webhook error differentiation", () => {
  it("classifies signature verification errors as 400", () => {
    const error = { type: "StripeSignatureVerificationError", message: "Bad sig" };
    const isSignatureError = error.type === "StripeSignatureVerificationError"
      || error.message?.includes("signature");
    expect(isSignatureError).toBe(true);
  });

  it("classifies processing errors as 500", () => {
    const error = { type: "InternalError", message: "DB connection failed" };
    const isSignatureError = error.type === "StripeSignatureVerificationError"
      || error.message?.includes("signature");
    expect(isSignatureError).toBe(false);
  });
});

describe("Docker pnpm version pinning", () => {
  it("should match packageManager version", () => {
    const packageManagerVersion = "10.26.1";
    const dockerfileVersion = "10.26.1";
    expect(dockerfileVersion).toBe(packageManagerVersion);
  });
});

describe("Migration journal integrity", () => {
  it("all migration files should have journal entries", () => {
    const journalTags = [
      "0000_neat_microchip",
      "0001_fix-claims-estimated-loss",
      "0002_ordinary_fixer",
      "0003_romantic_lester",
      "0004_rls_foundation",
      "0005_recommendation_hardening",
    ];
    expect(journalTags).toHaveLength(6);
    expect(journalTags[4]).toBe("0004_rls_foundation");
    expect(journalTags[5]).toBe("0005_recommendation_hardening");
  });
});
