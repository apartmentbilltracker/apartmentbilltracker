#!/usr/bin/env node

/**
 * Test Dashboard Endpoint
 * Calls the financial dashboard endpoint and logs the response
 */

require("dotenv").config({ path: __dirname + "/config/.env" });

const axios = require("axios");

const API_BASE_URL = "http://localhost:4000";

async function testDashboardEndpoint() {
  try {
    // Get a valid JWT token first (you'll need to authenticate)
    const auth = await axios.post(`${API_BASE_URL}/api/v2/auth/login`, {
      email: "test@example.com", // Replace with actual test user
      password: "password", // Replace with actual password
    });

    const token = auth.data?.token;
    if (!token) {
      console.error("❌ Could not get authentication token");
      console.log("Create a test user first and update the credentials");
      return;
    }

    console.log("✅ Authenticated successfully\n");

    // Get rooms list
    const roomsRes = await axios.get(`${API_BASE_URL}/api/v2/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const rooms = roomsRes.data?.rooms || [];
    if (rooms.length === 0) {
      console.log("❌ No rooms found");
      return;
    }

    console.log(`📋 Found ${rooms.length} rooms\n`);

    // Test the dashboard endpoint for the first room
    const testRoom = rooms[0];
    console.log(
      `Testing dashboard for room: ${testRoom.name} (${testRoom.id})\n`,
    );

    const dashResponse = await axios.get(
      `${API_BASE_URL}/api/v2/admin/financial/dashboard/${testRoom.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const dashboard = dashResponse.data?.dashboard;

    if (!dashboard) {
      console.error("❌ No dashboard data in response");
      console.log(JSON.stringify(dashResponse.data, null, 2));
      return;
    }

    console.log("✅ Dashboard Response:\n");
    console.log("─".repeat(100));

    // Log key data points
    console.log(`Total Billed: ₱${dashboard.totalBilled?.toFixed(2)}`);
    console.log(`Total Collected: ₱${dashboard.totalCollected?.toFixed(2)}`);
    console.log(`Outstanding: ₱${dashboard.outstanding?.toFixed(2)}`);
    console.log(`Collection Rate: ${dashboard.collectionRate}%\n`);

    console.log("Payment Breakdown:");
    if (dashboard.paymentBreakdown) {
      Object.entries(dashboard.paymentBreakdown).forEach(([key, values]) => {
        console.log(`  ${key}:`);
        console.log(`    Expected: ₱${values?.expected?.toFixed(2) || 0}`);
        console.log(`    Collected: ₱${values?.collected?.toFixed(2) || 0}`);
        console.log(`    Pending: ₱${values?.pending?.toFixed(2) || 0}`);
      });
    }

    console.log("\nCustom Charges:");
    if (dashboard.customCharges && dashboard.customCharges.length > 0) {
      console.log("  ✅ Found custom charges:");
      dashboard.customCharges.forEach((c) => {
        console.log(`    - ${c.name}: ₱${(c.amount || 0).toFixed(2)}`);
      });
      const total = dashboard.customCharges.reduce(
        (sum, c) => sum + (c.amount || 0),
        0,
      );
      console.log(`    Total: ₱${total.toFixed(2)}`);
    } else {
      console.log("  ❌ No custom charges found");
    }

    console.log("\n" + "─".repeat(100));
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

testDashboardEndpoint();
