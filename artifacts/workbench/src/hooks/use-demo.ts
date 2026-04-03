const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export function useDemo() {
  return {
    isDemo: DEMO_MODE,
    tenant: DEMO_MODE ? "Lorian Freight Solutions" : null,
  };
}

export { DEMO_MODE };
