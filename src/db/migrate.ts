import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is not set");

async function main() {
const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
  create table if not exists schema_migrations (
    id text primary key,
    applied_at timestamptz not null default now()
  )
`);

const dir = join(process.cwd(), "src/db/sql");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const existing = await client.query(
    "select 1 from schema_migrations where id = $1",
    [file],
  );
  if (existing.rowCount) {
    console.log(`skip ${file}`);
    continue;
  }
  const sqlText = readFileSync(join(dir, file), "utf8");
  await client.query("begin");
  try {
    await client.query(sqlText);
    await client.query("insert into schema_migrations (id) values ($1)", [file]);
    await client.query("commit");
    console.log(`applied ${file}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
