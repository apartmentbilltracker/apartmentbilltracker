#!/usr/bin/env node

/**
 * Debug Script - Check Billing Cycles Data
 * Shows what's actually in your database for custom_charges
 */

require("dotenv").config({ path: __dirname + "/config/.env" });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
);

async function debugBillingCycles() {
  try {
    console.log("📋 Fetching active billing cycles...\n");

    const { data: cycles, error } = await supabase
      .from("billing_cycles")
      .select(
        "id, room_id, status, rent, electricity, water_bill_amount, internet, custom_charges, total_billed_amount",
      )
      .eq("status", "active")
      .limit(5);

    if (error) {
      console.error("❌ Error fetching cycles:", error.message);
      return;
    }

    if (!cycles || cycles.length === 0) {
      console.log("ℹ️  No active billing cycles found\n");
      return;
    }

    console.log(`✅ Found ${cycles.length} active billing cycle(s)\n`);
    console.log("─".repeat(100));

    cycles.forEach((cycle, index) => {
      console.log(`\n📊 Cycle ${index + 1}:`);
      console.log(`   ID: ${cycle.id}`);
      console.log(`   Room ID: ${cycle.room_id}`);
      console.log(`   Status: ${cycle.status}`);
      console.log(`   Rent: ₱${(cycle.rent || 0).toFixed(2)}`);
      console.log(`   Electricity: ₱${(cycle.electricity || 0).toFixed(2)}`);
      console.log(`   Water: ₱${(cycle.water_bill_amount || 0).toFixed(2)}`);
      console.log(`   Internet: ₱${(cycle.internet || 0).toFixed(2)}`);

      // Check for custom charges
      if (cycle.custom_charges) {
        try {
          const charges =
            typeof cycle.custom_charges === "string"
              ? JSON.parse(cycle.custom_charges)
              : cycle.custom_charges;

          console.log(`   Custom Charges: ✅`);
          charges.forEach((c) => {
            console.log(`     - ${c.name}: ₱${(c.amount || 0).toFixed(2)}`);
          });

          const customTotal = charges.reduce(
            (sum, c) => sum + parseFloat(c.amount || 0),
            0,
          );
          console.log(`     Total Custom: ₱${customTotal.toFixed(2)}`);
        } catch (err) {
          console.log(`   Custom Charges: ⚠️  Parse Error: ${err.message}`);
        }
      } else {
        console.log(`   Custom Charges: ❌ (null or empty)`);
      }

      console.log(
        `   Total Billed (from DB): ₱${(cycle.total_billed_amount || 0).toFixed(2)}`,
      );

      // Calculate expected total
      const expectedTotal =
        parseFloat(cycle.rent || 0) +
        parseFloat(cycle.electricity || 0) +
        parseFloat(cycle.water_bill_amount || 0) +
        parseFloat(cycle.internet || 0);

      // Include custom charges if present
      let totalWithCustom = expectedTotal;
      if (cycle.custom_charges) {
        try {
          const charges =
            typeof cycle.custom_charges === "string"
              ? JSON.parse(cycle.custom_charges)
              : cycle.custom_charges;
          const customTotal = charges.reduce(
            (sum, c) => sum + parseFloat(c.amount || 0),
            0,
          );
          totalWithCustom = expectedTotal + customTotal;
        } catch (err) {
          // Ignore
        }
      }

      console.log(
        `   Expected Total (with custom): ₱${totalWithCustom.toFixed(2)}`,
      );

      if (Math.abs(totalWithCustom - (cycle.total_billed_amount || 0)) > 0.01) {
        console.log(
          `   ⚠️  MISMATCH! DB has ${cycle.total_billed_amount}, expected ${totalWithCustom.toFixed(2)}`,
        );
      } else {
        console.log(`   ✅ Total matches correctly`);
      }
    });

    console.log("\n" + "─".repeat(100));
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

debugBillingCycles();
