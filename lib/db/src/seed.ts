import { seedReferenceData } from "./seed-reference-data.js";
import { seedLorian } from "./lorian-demo/seed-lorian.js";

async function main() {
  try {
    console.log("=== DYNASTIES PLATFORM SEED ===\n");

    await seedReferenceData();
    console.log("");

    await seedLorian();
    console.log("");

    console.log("=== SEED COMPLETE ===");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

main();
