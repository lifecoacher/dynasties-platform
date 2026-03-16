import { destroyLorian } from "./destroy-lorian.js";
import { seedLorian } from "./seed-lorian.js";

export async function resetLorian() {
  console.log("=== RESETTING LORIAN DEMO ENVIRONMENT ===\n");

  await destroyLorian();
  console.log("");
  await seedLorian();

  console.log("\n=== LORIAN DEMO RESET COMPLETE ===");
}

if (process.argv[1]?.endsWith("reset-lorian.ts") || process.argv[1]?.endsWith("reset-lorian.js")) {
  resetLorian().then(() => process.exit(0)).catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
}
