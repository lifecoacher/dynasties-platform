import { seedReferenceData } from "./seed-reference-data.js";
import { seedDemoData } from "./seed-demo-data.js";

async function main() {
  try {
    console.log("=== DYNASTIES PLATFORM SEED ===\n");

    await seedReferenceData();
    console.log("");

    await seedDemoData();
    console.log("");

    console.log("=== SEED COMPLETE ===");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

main();
