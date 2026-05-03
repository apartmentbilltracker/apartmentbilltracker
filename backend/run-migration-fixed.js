/**
 * Database Migration Runner (Fixed for Supabase)
 * Executes SQL migration files using Supabase API
 */

require("dotenv").config({ path: __dirname + "/config/.env" });

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

async function runMigration(filename) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const migrationPath = path.join(__dirname, "migrations", filename);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, "utf-8");
    console.log(`📝 Running migration: ${filename}`);
    console.log("─".repeat(60));

    const { data, error } = await supabase.rpc("exec_sql_unsafe", {
      sql: sql,
    });

    if (error) {
      if (error.message && error.message.includes("does not exist")) {
        console.error("❌ RPC method 'exec_sql_unsafe' not available");
        console.error("Please run the SQL manually in Supabase SQL Editor:\n");
        console.log(sql);
      } else {
        throw error;
      }
      process.exit(1);
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
  console.error("Usage: node run-migration-fixed.js <filename>");
  process.exit(1);
}

runMigration(filename);
