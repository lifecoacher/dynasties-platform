const LEGAL_SUFFIXES = [
  "inc",
  "incorporated",
  "ltd",
  "limited",
  "llc",
  "llp",
  "corp",
  "corporation",
  "co",
  "company",
  "gmbh",
  "ag",
  "sa",
  "srl",
  "bv",
  "nv",
  "pty",
  "pte",
  "plc",
  "kg",
  "ohg",
  "ug",
  "sarl",
  "sas",
  "eurl",
];

export function normalizeEntityName(name: string): string {
  let normalized = name.trim().toLowerCase();

  normalized = normalized.replace(/[.,;:'"()[\]{}!@#$%^&*]/g, "");

  const words = normalized.split(/\s+/);
  const filtered = words.filter((w) => !LEGAL_SUFFIXES.includes(w));

  return filtered.join(" ").trim();
}
