export const DEMO_COMPANY_IDS: ReadonlySet<string> = new Set([
  "cmp_lorian_001",
]);

export function isDemoCompany(companyId: string | null | undefined): boolean {
  if (!companyId) return false;
  return DEMO_COMPANY_IDS.has(companyId);
}
