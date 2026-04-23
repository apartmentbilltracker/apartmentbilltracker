/**
 * Database Migration Runner
 * Executes SQL migration files for Supabase
 *
 * Usage: node run-migration.js <migration_file_name>
 * Example: node run-migration.js add_custom_charges_column.sql
 */

require("dotenv").config({ path: __dirname + "/config/.env" });

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
);

async function runMigration(filename) {
  try {
    const migrationPath = path.join(__dirname, "migrations", filename);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, "utf-8");
    console.log(`📝 Running migration: ${filename}`);
    console.log("─".repeat(60));

    const { error } = await supabase.rpc("exec_sql", { sql });

    if (error) {
      // Try executing as raw SQL via different method
      console.log("⚠️  RPC method failed, attempting direct execution...");
      const { error: directError } = await supabase
        .from("_migrations")
        .select("*")
        .limit(1)
        .then(() => supabase.query(sql));

      if (directError) {
        console.error("❌ Migration failed:");
        console.error(directError);
        process.exit(1);
      }
    }

    console.log("✅ Migration completed successfully!");
  } catch (err) {
    console.error("❌ Error running migration:");
    console.error(err.message);
    process.exit(1);
  }
}

const filename = process.argv[2];
if (!filename) {
  console.error("❌ Please provide a migration filename");
  console.error("Usage: node run-migration.js <filename>");
  process.exit(1);
}

runMigration(filename);
