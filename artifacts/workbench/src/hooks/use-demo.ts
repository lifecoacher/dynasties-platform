import { useAuth } from "./use-auth";

const DEMO_MODE_ENV = import.meta.env.VITE_DEMO_MODE === "true";

/**
 * Server-driven demo flag. The API marks specific tenants (e.g. the Lorian
 * showcase) as demo via /auth/me; we surface that to the UI so banners and
 * gated nav items reflect tenant identity instead of a build-time env var.
 * Falls back to VITE_DEMO_MODE for backward compatibility when the user
 * record hasn't been hydrated yet.
 */
export function useIsDemo(): boolean {
  const { user } = useAuth();
  if (user && typeof user.isDemo === "boolean") return user.isDemo;
  return DEMO_MODE_ENV;
}

export function useDemo() {
  const { user } = useAuth();
  const isDemo = useIsDemo();
  return {
    isDemo,
    tenant: user?.companyName ?? null,
  };
}

// Build-time fallback retained for non-React contexts.
export const DEMO_MODE = DEMO_MODE_ENV;
