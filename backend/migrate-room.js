/**
 * Room Data Migration Script
 *
 * Copies all data from a source room to a target room:
 *   - Members (with presence data, payer status)
 *   - Billing cycles (with charges)
 *   - Payments
 *   - Settlements
 *   - Announcements
 *   - Chat messages
 *
 * Usage: node migrate-room.js
 *
 * ⚠️  This uses the SERVICE_ROLE_KEY to bypass RLS.
 *     Run ONCE, then delete this file.
 */
require("dotenv").config({ path: __dirname + "/config/.env" });

const SOURCE_ROOM_ID = "ba127c31-4dfd-46c5-9de2-e1f26528392d";
const TARGET_ROOM_ID = "7d15f831-14ef-4bfd-8935-75e404a1bfea";

// ── Dry-run mode: set to false to actually write data ──
const DRY_RUN = false;

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
);

async function fetchAll(table, roomId, roomColumn = "room_id") {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq(roomColumn, roomId);
  if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
  return data || [];
}

async function insertMany(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error)
    throw new Error(`Failed to insert into ${table}: ${error.message}`);
  return data || [];
}

async function migrate() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║          ROOM DATA MIGRATION SCRIPT             ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Source room: ${SOURCE_ROOM_ID}`);
  console.log(`  Target room: ${TARGET_ROOM_ID}`);
  console.log(
    `  Mode:        ${DRY_RUN ? "🔍 DRY RUN (no writes)" : "⚡ LIVE (will write data)"}`,
  );
  console.log();

  // ── 1. Verify both rooms exist ──
  const { data: sourceRoom } = await supabase
    .from("rooms")
    .select("id, name, created_by")
    .eq("id", SOURCE_ROOM_ID)
    .single();
  const { data: targetRoom } = await supabase
    .from("rooms")
    .select("id, name, created_by")
    .eq("id", TARGET_ROOM_ID)
    .single();

  if (!sourceRoom) {
    console.error("❌ Source room not found!");
    return;
  }
  if (!targetRoom) {
    console.error("❌ Target room not found!");
    return;
  }

  console.log(
    `  Source: "${sourceRoom.name}" (owner: ${sourceRoom.created_by})`,
  );
  console.log(
    `  Target: "${targetRoom.name}" (owner: ${targetRoom.created_by})`,
  );
  console.log();

  // ── 2. Fetch all source data ──
  console.log("── Fetching source data ──");

  const sourceMembers = await fetchAll("room_members", SOURCE_ROOM_ID);
  console.log(`  room_members:    ${sourceMembers.length} rows`);

  const sourceCycles = await fetchAll("billing_cycles", SOURCE_ROOM_ID);
  console.log(`  billing_cycles:  ${sourceCycles.length} rows`);

  // Fetch charges for all billing cycles
  const cycleIds = sourceCycles.map((c) => c.id);
  let sourceCharges = [];
  if (cycleIds.length > 0) {
    const { data, error } = await supabase
      .from("billing_cycle_charges")
      .select("*")
      .in("billing_cycle_id", cycleIds);
    if (error) console.warn(`  ⚠️  billing_cycle_charges: ${error.message}`);
    sourceCharges = data || [];
  }
  console.log(`  billing_cycle_charges: ${sourceCharges.length} rows`);

  const sourcePayments = await fetchAll("payments", SOURCE_ROOM_ID);
  console.log(`  payments:        ${sourcePayments.length} rows`);

  const sourceSettlements = await fetchAll("settlements", SOURCE_ROOM_ID);
  console.log(`  settlements:     ${sourceSettlements.length} rows`);

  let sourceAnnouncements = [];
  try {
    sourceAnnouncements = await fetchAll("announcements", SOURCE_ROOM_ID);
    console.log(`  announcements:   ${sourceAnnouncements.length} rows`);
  } catch (e) {
    console.log(`  announcements:   (table not found, skipping)`);
  }

  let sourceChatMessages = [];
  try {
    sourceChatMessages = await fetchAll("chat_messages", SOURCE_ROOM_ID);
    console.log(`  chat_messages:   ${sourceChatMessages.length} rows`);
  } catch (e) {
    console.log(`  chat_messages:   (table not found, skipping)`);
  }

  let sourcePaymentTransactions = [];
  try {
    // Payment transactions reference payment IDs, not room_id directly
    const paymentIds = sourcePayments.map((p) => p.id);
    if (paymentIds.length > 0) {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("*")
        .in("payment_id", paymentIds);
      if (!error) sourcePaymentTransactions = data || [];
    }
    console.log(
      `  payment_transactions: ${sourcePaymentTransactions.length} rows`,
    );
  } catch (e) {
    console.log(`  payment_transactions: (table not found, skipping)`);
  }

  console.log();

  // ── 3. Check for existing data in target ──
  const targetMembers = await fetchAll("room_members", TARGET_ROOM_ID);
  const targetCycles = await fetchAll("billing_cycles", TARGET_ROOM_ID);
  if (targetMembers.length > 0 || targetCycles.length > 0) {
    console.log(
      `  ⚠️  Target room already has ${targetMembers.length} members and ${targetCycles.length} billing cycles.`,
    );
    console.log(
      `     Migration will ADD data (not replace). Duplicate members (same user_id) will be skipped.`,
    );
    console.log();
  }

  // ── 4. Build migration data ──
  // Members: skip any that already exist in target (by user_id)
  const existingUserIds = new Set(targetMembers.map((m) => m.user_id));
  const newMembers = sourceMembers
    .filter((m) => !existingUserIds.has(m.user_id))
    .map((m) => {
      const { id, ...rest } = m; // Remove old PK
      return { ...rest, room_id: TARGET_ROOM_ID };
    });

  // Billing cycles: we'll need to map old cycle IDs to new ones
  const cycleRows = sourceCycles.map((c) => {
    const { id, ...rest } = c;
    return { ...rest, room_id: TARGET_ROOM_ID, _old_id: id };
  });

  // Payments: remap room_id
  const paymentRows = sourcePayments.map((p) => {
    const { id, ...rest } = p;
    return { ...rest, room_id: TARGET_ROOM_ID, _old_id: id };
  });

  // Settlements: remap room_id
  const settlementRows = sourceSettlements.map((s) => {
    const { id, ...rest } = s;
    return { ...rest, room_id: TARGET_ROOM_ID };
  });

  // Announcements: remap room_id
  const announcementRows = sourceAnnouncements.map((a) => {
    const { id, ...rest } = a;
    return { ...rest, room_id: TARGET_ROOM_ID };
  });

  // Chat messages: remap room_id
  const chatRows = sourceChatMessages.map((c) => {
    const { id, ...rest } = c;
    return { ...rest, room_id: TARGET_ROOM_ID };
  });

  console.log("── Migration plan ──");
  console.log(
    `  Members to add:         ${newMembers.length} (${sourceMembers.length - newMembers.length} already exist)`,
  );
  console.log(`  Billing cycles to copy: ${cycleRows.length}`);
  console.log(`  Charges to copy:        ${sourceCharges.length}`);
  console.log(`  Payments to copy:       ${paymentRows.length}`);
  console.log(`  Payment txns to copy:   ${sourcePaymentTransactions.length}`);
  console.log(`  Settlements to copy:    ${settlementRows.length}`);
  console.log(`  Announcements to copy:  ${announcementRows.length}`);
  console.log(`  Chat messages to copy:  ${chatRows.length}`);
  console.log();

  if (DRY_RUN) {
    console.log("🔍 DRY RUN complete. No data was written.");
    console.log(
      "   To execute the migration, set DRY_RUN = false in this file and run again.",
    );
    return;
  }

  // ── 5. Execute migration ──
  console.log("── Executing migration ──");

  // 5a. Members
  if (newMembers.length > 0) {
    const inserted = await insertMany("room_members", newMembers);
    console.log(`  ✅ room_members: ${inserted.length} inserted`);
  } else {
    console.log(`  ⏭️  room_members: nothing to insert`);
  }

  // 5b. Billing cycles (need ID mapping for charges)
  const oldToNewCycleId = {};
  if (cycleRows.length > 0) {
    for (const row of cycleRows) {
      const oldId = row._old_id;
      delete row._old_id;
      const { data, error } = await supabase
        .from("billing_cycles")
        .insert([row])
        .select()
        .single();
      if (error) {
        console.error(`  ❌ billing_cycle (old: ${oldId}): ${error.message}`);
      } else {
        oldToNewCycleId[oldId] = data.id;
        console.log(`  ✅ billing_cycle: ${oldId} → ${data.id}`);
      }
    }
  } else {
    console.log(`  ⏭️  billing_cycles: nothing to insert`);
  }

  // 5c. Billing cycle charges (remap billing_cycle_id)
  if (sourceCharges.length > 0) {
    const chargeRows = sourceCharges
      .filter((c) => oldToNewCycleId[c.billing_cycle_id]) // only if parent cycle was migrated
      .map((c) => {
        const { id, ...rest } = c;
        return {
          ...rest,
          billing_cycle_id: oldToNewCycleId[c.billing_cycle_id],
        };
      });
    if (chargeRows.length > 0) {
      const inserted = await insertMany("billing_cycle_charges", chargeRows);
      console.log(`  ✅ billing_cycle_charges: ${inserted.length} inserted`);
    }
  } else {
    console.log(`  ⏭️  billing_cycle_charges: nothing to insert`);
  }

  // 5d. Payments (need ID mapping for payment_transactions)
  const oldToNewPaymentId = {};
  if (paymentRows.length > 0) {
    for (const row of paymentRows) {
      const oldId = row._old_id;
      delete row._old_id;
      const { data, error } = await supabase
        .from("payments")
        .insert([row])
        .select()
        .single();
      if (error) {
        console.error(`  ❌ payment (old: ${oldId}): ${error.message}`);
      } else {
        oldToNewPaymentId[oldId] = data.id;
      }
    }
    console.log(
      `  ✅ payments: ${Object.keys(oldToNewPaymentId).length} inserted`,
    );
  } else {
    console.log(`  ⏭️  payments: nothing to insert`);
  }

  // 5e. Payment transactions (remap payment_id)
  if (sourcePaymentTransactions.length > 0) {
    const txnRows = sourcePaymentTransactions
      .filter((t) => oldToNewPaymentId[t.payment_id])
      .map((t) => {
        const { id, ...rest } = t;
        return { ...rest, payment_id: oldToNewPaymentId[t.payment_id] };
      });
    if (txnRows.length > 0) {
      const inserted = await insertMany("payment_transactions", txnRows);
      console.log(`  ✅ payment_transactions: ${inserted.length} inserted`);
    }
  } else {
    console.log(`  ⏭️  payment_transactions: nothing to insert`);
  }

  // 5f. Settlements
  if (settlementRows.length > 0) {
    const inserted = await insertMany("settlements", settlementRows);
    console.log(`  ✅ settlements: ${inserted.length} inserted`);
  } else {
    console.log(`  ⏭️  settlements: nothing to insert`);
  }

  // 5g. Announcements
  if (announcementRows.length > 0) {
    const inserted = await insertMany("announcements", announcementRows);
    console.log(`  ✅ announcements: ${inserted.length} inserted`);
  } else {
    console.log(`  ⏭️  announcements: nothing to insert`);
  }

  // 5h. Chat messages
  if (chatRows.length > 0) {
    const inserted = await insertMany("chat_messages", chatRows);
    console.log(`  ✅ chat_messages: ${inserted.length} inserted`);
  } else {
    console.log(`  ⏭️  chat_messages: nothing to insert`);
  }

  console.log();
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║          ✅ MIGRATION COMPLETE!                  ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();
  console.log("  You can now safely delete this script: migrate-room.js");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
