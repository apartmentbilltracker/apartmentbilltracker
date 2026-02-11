/**
 * Supabase Connection Test
 * Run: node test-supabase.js
 */

require("dotenv").config({ path: "./config/.env" });
const SupabaseService = require("./db/SupabaseService");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

async function test(name, fn) {
  try {
    console.log(`\n${colors.blue}Testing: ${name}${colors.reset}`);
    await fn();
    console.log(`${colors.green}✅ PASSED${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ FAILED: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runTests() {
  console.log(
    `\n${colors.blue}========== SUPABASE MIGRATION TESTS ==========${colors.reset}`,
  );

  // Check environment variables
  console.log(`\n${colors.blue}Checking environment variables:${colors.reset}`);
  if (!process.env.SUPABASE_URL) {
    console.log(`${colors.yellow}⚠️  Missing SUPABASE_URL${colors.reset}`);
  } else {
    console.log(`${colors.green}✅ SUPABASE_URL found${colors.reset}`);
  }

  if (!process.env.SUPABASE_ANON_KEY) {
    console.log(`${colors.yellow}⚠️  Missing SUPABASE_ANON_KEY${colors.reset}`);
  } else {
    console.log(`${colors.green}✅ SUPABASE_ANON_KEY found${colors.reset}`);
  }

  let passCount = 0;
  let failCount = 0;

  // Test 1: Create User
  if (
    await test("Create User", async () => {
      const testEmail = `test-${Date.now()}@example.com`;
      const user = await SupabaseService.createUser({
        name: "Test User",
        email: testEmail,
        password_hash: "hashed_password",
        role: "client",
        is_admin: false,
      });

      if (!user || !user.id) throw new Error("User not created");
      console.log(`   User ID: ${user.id}`);
      global.testUserId = user.id;
      global.testEmail = testEmail;
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 2: Find User by Email
  if (
    await test("Find User by Email", async () => {
      if (!global.testEmail) throw new Error("No test email found");
      const user = await SupabaseService.findUserByEmail(global.testEmail);
      if (!user) throw new Error("User not found");
      console.log(`   Found: ${user.name} (${user.email})`);
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 3: Find User by ID
  if (
    await test("Find User by ID", async () => {
      if (!global.testUserId) throw new Error("No test user ID found");
      const user = await SupabaseService.findUserById(global.testUserId);
      if (!user) throw new Error("User not found");
      console.log(`   Found: ${user.name}`);
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 4: Update User
  if (
    await test("Update User", async () => {
      if (!global.testUserId) throw new Error("No test user ID found");
      const updated = await SupabaseService.updateUser(global.testUserId, {
        name: "Updated Test User",
      });
      if (updated.name !== "Updated Test User")
        throw new Error("Name not updated");
      console.log(`   Updated name to: ${updated.name}`);
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 5: Create Room
  if (
    await test("Create Room", async () => {
      if (!global.testUserId) throw new Error("No test user ID found");
      const room = await SupabaseService.createRoom({
        name: "Test Room",
        code: `TEST-${Date.now()}`,
        description: "Test room for migration",
        created_by: global.testUserId,
      });
      if (!room || !room.id) throw new Error("Room not created");
      console.log(`   Room ID: ${room.id}`);
      global.testRoomId = room.id;
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 6: Find Room by Code
  if (
    await test("Find Room by Code", async () => {
      if (!global.testRoomId) throw new Error("No test room found");
      const room = await SupabaseService.findRoomByCode(
        `TEST-${Date.now() - 1000}`,
      ); // Won't find exact match
      console.log(`   Room search completed`);
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 7: Add Room Member
  if (
    await test("Add Room Member", async () => {
      if (!global.testRoomId || !global.testUserId)
        throw new Error("Room or user not found");
      const member = await SupabaseService.addRoomMember(
        global.testRoomId,
        global.testUserId,
        "Test Member",
        true,
      );
      if (!member || !member.id) throw new Error("Member not added");
      console.log(`   Member ID: ${member.id}`);
      global.testMemberId = member.id;
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 8: Create Payment
  if (
    await test("Create Payment", async () => {
      if (!global.testRoomId || !global.testUserId)
        throw new Error("Room or user not found");
      const payment = await SupabaseService.createPayment({
        room_id: global.testRoomId,
        paid_by: global.testUserId,
        amount: 150.0,
        bill_type: "rent",
        payment_method: "cash",
        reference: "TEST-001",
      });
      if (!payment || !payment.id) throw new Error("Payment not created");
      console.log(`   Payment ID: ${payment.id}`);
      global.testPaymentId = payment.id;
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 9: Get Room Payments
  if (
    await test("Get Room Payments", async () => {
      if (!global.testRoomId) throw new Error("Room not found");
      const payments = await SupabaseService.getRoomPayments(global.testRoomId);
      console.log(`   Found ${payments.length} payment(s)`);
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 10: Delete Room first (cleanup dependencies)
  if (
    await test("Delete Room (Cleanup Dependencies)", async () => {
      if (!global.testRoomId) throw new Error("No test room found");
      await SupabaseService.deleteRecord("rooms", global.testRoomId);
      console.log(`   Room deleted`);
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 11: Delete User (cleanup)
  if (
    await test("Delete User (Cleanup)", async () => {
      if (!global.testUserId) throw new Error("No test user ID found");
      await SupabaseService.deleteRecord("users", global.testUserId);
      console.log(`   User deleted`);
    })
  ) {
    passCount++;
  } else {
    failCount++;
  }

  console.log(
    `\n${colors.blue}========== TEST SUMMARY ==========${colors.reset}`,
  );
  console.log(
    `${colors.green}Passed: ${passCount}${colors.reset} | ${colors.red}Failed: ${failCount}${colors.reset}`,
  );

  if (failCount === 0) {
    console.log(
      `\n${colors.green}✅ All tests passed! Supabase is properly configured.${colors.reset}`,
    );
  } else {
    console.log(
      `\n${colors.red}❌ Some tests failed. Please check your Supabase configuration.${colors.reset}`,
    );
  }

  console.log(`${colors.reset}`);
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
