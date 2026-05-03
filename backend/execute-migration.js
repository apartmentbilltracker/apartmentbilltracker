/**
 * Migration Executor using Supabase
 * Executes SQL migrations directly
 */

require("dotenv").config({ path: __dirname + "/config/.env" });

const fs = require("fs");
const path = require("path");
const supabase = require("./db/SupabaseClient");

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
    console.log("SQL to execute:");
    console.log(sql);
    console.log("─".repeat(60));

    // Split SQL by semicolon and execute each statement
    const statements = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      const { data, error } = await supabase.rpc("exec_sql_unsafe", {
        sql: statement + ";",
      });

      if (error) {
        // If RPC doesn't exist, try direct query
        if (error.message.includes("does not exist")) {
          console.error(
            "❌ Cannot execute migration - RPC function not available",
          );
          console.error(
            "⚠️  Please run this SQL manually in Supabase SQL Editor:\n",
          );
          console.log(sql);
          process.exit(1);
        }
        throw error;
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
  console.error("Usage: node execute-migration.js <filename>");
  process.exit(1);
}

runMigration(filename);
