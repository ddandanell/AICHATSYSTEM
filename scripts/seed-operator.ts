/**
 * Seed the approved owner operator from OPERATOR_BOOTSTRAP_* env vars.
 * Writes a scrypt hash only. Never prints the password or connection string.
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import { ensureBootstrapOperator, listOperators } from "../src/lib/operators";

async function main() {
  await ensureBootstrapOperator();
  const operators = await listOperators();
  const owner = operators.find((row) => row.email === "bali@mychef.id");
  if (!owner?.approved) {
    console.error("Owner operator was not seeded.");
    process.exit(1);
  }
  console.log(`Seeded operator ${owner.email} role=${owner.role} approved=${owner.approved}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exit(1);
});
