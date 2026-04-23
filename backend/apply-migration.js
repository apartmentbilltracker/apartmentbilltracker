#!/usr/bin/env node

/**
 * Custom Charges Migration Setup
 * This script helps apply the custom_charges database migration
 */

require("dotenv").config({ path: __dirname + "/config/.env" });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function applyMigration() {
  try {
    console.log("🔧 Applying custom_charges migration...\n");

    // SQL to add custom_charges column
    const sql = `
      ALTER TABLE billing_cycles
      ADD COLUMN IF NOT EXISTS custom_charges jsonb DEFAULT NULL;

      CREATE INDEX IF NOT EXISTS idx_billing_cycles_custom_charges
      ON billing_cycles USING gin(custom_charges);
    `;

    // Execute using Supabase RPC with unsafe SQL execution
    const { data, error } = await supabase.rpc("exec_sql_unsafe", {
      sql: sql,
    });

    if (error && error.message.includes("does not exist")) {
      // RPC doesn't exist, try alternative approach
      console.log(
        "ℹ️  RPC method not available. Please run this SQL manually in Supabase:\n",
      );
      console.log("─".repeat(80));
      console.log(sql);
      console.log("─".repeat(80));
      console.log("\n📋 Steps:");
      console.log("1. Go to your Supabase project");
      console.log("2. Open the SQL Editor");
      console.log("3. Create a new query and paste the SQL above");
      console.log("4. Click 'Run'\n");
      return;
    }

    if (error) {
      throw error;
    }

    console.log("✅ Migration applied successfully!");
    console.log("✅ custom_charges column added to billing_cycles table");
    console.log("✅ Index created for faster queries\n");
  } catch (err) {
    console.error("❌ Error applying migration:");
    console.error(err.message);

    console.log("\n📋 Please run this SQL manually in Supabase SQL Editor:\n");
    console.log("─".repeat(80));
    console.log(`
      ALTER TABLE billing_cycles
      ADD COLUMN IF NOT EXISTS custom_charges jsonb DEFAULT NULL;

      CREATE INDEX IF NOT EXISTS idx_billing_cycles_custom_charges
      ON billing_cycles USING gin(custom_charges);
    `);
    console.log("─".repeat(80));
  }
}

applyMigration();
