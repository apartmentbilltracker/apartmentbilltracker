# Supabase Migration - Quick Start

Fast-track guide to get Supabase up and running with your existing backend.

## Prerequisites

- Node.js installed
- Supabase account (free tier available at https://supabase.com)
- Your existing backend code

## Phase 1: Supabase Project Setup (15 minutes)

### 1.1 Create Project

```bash
# Go to https://supabase.com/dashboard
# Click "New Project"
# Fill in: Project name, Database password, Region (choose closest to your users)
# Wait 2-3 minutes for provisioning
```

### 1.2 Capture Credentials

After project is created:

1. Go to **Settings → Database** and save:
   - `Host`: `db.xxxx.supabase.co`
   - `Port`: `5432`
   - `Database`: `postgres`
   - `User`: `postgres`
   - `Password`: (what you set during creation)

2. Go to **Settings → API** and save:
   - Project URL: `https://xxxx.supabase.co`
   - Anon Key: `eyJhbGc...` (starts with "ey")
   - Service Role Key: `eyJhbGc...` (longer, starts with "ey")

### 1.3 Create Tables

1. Click **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy the entire schema from `SUPABASE_MIGRATION_GUIDE.md` Part 2, Step 2
4. Paste into SQL editor
5. Click **Run**
6. Verify all tables created (check **Table Editor** on left)

---

## Phase 2: Backend Setup (30 minutes)

### 2.1 Add Environment Variables

File: `backend/.env`

```
# Existing variables
DB_URL=your-mongodb-url-keep-for-now
SEND_EMAIL_PASS=your-email-password
# ... other existing vars ...

# NEW Supabase variables
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 2.2 Install Supabase SDK

```bash
cd backend
npm install @supabase/supabase-js
```

### 2.3 Create Supabase Client

File: `backend/db/SupabaseClient.js`

```javascript
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables",
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;
```

### 2.4 Create Database Helper Service

File: `backend/db/SupabaseService.js`

```javascript
const supabase = require("./SupabaseClient");

class SupabaseService {
  // Generic methods
  static async insert(table, data) {
    const { data: result, error } = await supabase
      .from(table)
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return result;
  }

  static async selectByColumn(table, column, value) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(column, value)
      .single();
    if (error && error.code !== "PGRST116") throw error; // Not found is OK
    return data;
  }

  static async selectAll(table, column, value, select = "*") {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq(column, value);
    if (error) throw error;
    return data;
  }

  static async update(table, id, updates) {
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteRecord(table, id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  }

  // Specialized methods
  static async createUser(userData) {
    return this.insert("users", userData);
  }

  static async findUserByEmail(email) {
    return this.selectByColumn("users", "email", email);
  }

  static async findUserById(id) {
    return this.selectByColumn("users", "id", id);
  }

  static async createRoom(roomData) {
    return this.insert("rooms", roomData);
  }

  static async findRoomByCode(code) {
    return this.selectByColumn("rooms", "code", code);
  }

  static async findRoomById(id) {
    const { data, error } = await supabase
      .from("rooms")
      .select(
        `*,
        room_members(*),
        room_billing(*)`,
      )
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  static async addRoomMember(roomId, userId, memberName, isPayer = true) {
    return this.insert("room_members", {
      room_id: roomId,
      user_id: userId,
      name: memberName,
      is_payer: isPayer,
      joined_at: new Date().toISOString(),
    });
  }

  static async createPayment(paymentData) {
    return this.insert("payments", paymentData);
  }

  static async getRoomPayments(roomId) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("room_id", roomId)
      .order("payment_date", { ascending: false });
    if (error) throw error;
    return data;
  }

  static async createBillingCycle(cycleData) {
    return this.insert("billing_cycles", cycleData);
  }

  static async getUserRooms(userId) {
    const { data, error } = await supabase
      .from("room_members")
      .select("room_id, rooms(*)")
      .eq("user_id", userId);
    if (error) throw error;
    return data;
  }
}

module.exports = SupabaseService;
```

---

## Phase 3: Testing (10 minutes)

### Test Connection

File: `backend/test-supabase.js`

```javascript
require("dotenv").config();
const SupabaseService = require("./db/SupabaseService");

async function testConnection() {
  try {
    console.log("Testing Supabase connection...");

    // Test insert
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      name: "Test User",
      password_hash: "hashed_password_here",
      role: "client",
      is_admin: false,
    };

    const user = await SupabaseService.createUser(testUser);
    console.log("✅ User created:", user.id);

    // Test select
    const foundUser = await SupabaseService.findUserById(user.id);
    console.log("✅ User found:", foundUser.name);

    // Test update
    const updated = await SupabaseService.update("users", user.id, {
      name: "Updated Name",
    });
    console.log("✅ User updated:", updated.name);

    // Test delete
    await SupabaseService.deleteRecord("users", user.id);
    console.log("✅ User deleted");

    console.log("\n✅ All Supabase tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testConnection();
```

Run test:

```bash
cd backend
node test-supabase.js
```

Expected output:

```
Testing Supabase connection...
✅ User created: 550e8400-e29b-41d4-a716-446655440000
✅ User found: Test User
✅ User updated: Updated Name
✅ User deleted

✅ All Supabase tests passed!
```

---

## Phase 4: Migrate User Auth Controller (30 minutes)

### Current MongoDB Controller (before)

File: `backend/controller/user.js` (existing)

```javascript
const User = require("../model/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.createUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return next(new ErrorHandler("User already exists", 400));
    }

    // Generate verification code
    const verifyCode = Math.floor(100000 + Math.random() * 900000);

    user = await User.create({
      name,
      email,
      verifyCode,
      verifyCodeExpiry: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Send email
    await sendVerificationEmail(email, verifyCode);

    res.status(201).json({
      success: true,
      message: "User created, check email for verification code",
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyActivationCode = async (req, res, next) => {
  try {
    const { email, verifyCode } = req.body;

    const user = await User.findOne({
      email,
      verifyCode: parseInt(verifyCode),
      verifyCodeExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorHandler("Invalid or expired code", 400));
    }

    user.isVerified = true;
    user.verifyCode = undefined;
    user.verifyCodeExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.setPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    user.password = password;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });

    res.status(200).json({
      success: true,
      message: "Password set successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
```

### New Supabase Controller (after)

We need to create a Pending Users system since Supabase doesn't have a temporary collection.

File: `backend/controller/user.js` (NEW VERSION)

Create this file:

```javascript
const SupabaseService = require("../db/SupabaseService");
const supabase = require("../db/SupabaseClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/ErrorHandler");
const sendVerificationEmail = require("../utils/sendVerificationEmail");

// Store pending users in memory (in production, use Redis or database)
const pendingUsers = new Map();

exports.createUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    if (!email || !name) {
      return next(new ErrorHandler("Name and email are required", 400));
    }

    // Check if user already exists
    const existingUser = await SupabaseService.findUserByEmail(email);
    if (existingUser) {
      return next(new ErrorHandler("User already exists", 400));
    }

    // Generate verification code
    const verifyCode = Math.floor(100000 + Math.random() * 900000);
    const codeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store in pending users
    pendingUsers.set(email, {
      name,
      email,
      verifyCode,
      codeExpiry,
      createdAt: new Date(),
    });

    // Send verification email
    await sendVerificationEmail(email, verifyCode);

    res.status(201).json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new ErrorHandler("Email is required", 400));
    }

    const pendingUser = pendingUsers.get(email);
    if (!pendingUser) {
      return next(new ErrorHandler("User not found or already verified", 400));
    }

    // Check if last code was sent less than 60 seconds ago
    if (
      pendingUser.lastResendTime &&
      Date.now() - pendingUser.lastResendTime < 60000
    ) {
      return next(
        new ErrorHandler("Please wait 60 seconds before resending", 429),
      );
    }

    // Generate new code
    const verifyCode = Math.floor(100000 + Math.random() * 900000);
    pendingUser.verifyCode = verifyCode;
    pendingUser.codeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    pendingUser.lastResendTime = Date.now();

    // Send email
    await sendVerificationEmail(email, verifyCode);

    res.status(200).json({
      success: true,
      message: "Verification code resent to your email",
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyActivationCode = async (req, res, next) => {
  try {
    const { email, verifyCode } = req.body;

    if (!email || !verifyCode) {
      return next(
        new ErrorHandler("Email and verification code are required", 400),
      );
    }

    const pendingUser = pendingUsers.get(email);
    if (!pendingUser) {
      return next(new ErrorHandler("User not found or already verified", 400));
    }

    // Check if code matches and not expired
    if (
      pendingUser.verifyCode !== parseInt(verifyCode) ||
      Date.now() > pendingUser.codeExpiry
    ) {
      return next(
        new ErrorHandler("Invalid or expired verification code", 400),
      );
    }

    // Mark as verified - move to next step
    pendingUser.verified = true;

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.setPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ErrorHandler("Email and password are required", 400));
    }

    if (password.length < 6) {
      return next(
        new ErrorHandler("Password must be at least 6 characters", 400),
      );
    }

    const pendingUser = pendingUsers.get(email);
    if (!pendingUser || !pendingUser.verified) {
      return next(new ErrorHandler("Please verify email first", 400));
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in Supabase
    const user = await SupabaseService.createUser({
      name: pendingUser.name,
      email: pendingUser.email,
      password_hash: hashedPassword,
      role: "client",
      is_admin: false,
    });

    // Remove from pending users
    pendingUsers.delete(email);

    // Generate JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ErrorHandler("Email and password are required", 400));
    }

    // Find user
    const user = await SupabaseService.findUserByEmail(email);
    if (!user) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    // Compare password
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    // Generate token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_admin: user.is_admin,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.logoutUser = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};
```

---

## Phase 5: Update Database Connection

File: `backend/server.js` or `backend/app.js`

Replace MongoDB connection:

**Before:**

```javascript
const connectDatabase = require("./db/Database");
connectDatabase();
```

**After:**

```javascript
// Supabase is initialized on demand in SupabaseService
// No need for initial connection - it uses HTTP API
console.log("✅ Supabase initialized");
```

---

## Phase 6: Migrate Remaining Controllers

Follow same pattern for other controllers:

1. Replace `require("../model/ModelName")` with `const SupabaseService = require("../db/SupabaseService")`
2. Replace `Model.find()` with `SupabaseService.selectAll()`
3. Replace `Model.findOne()` with `SupabaseService.selectByColumn()`
4. Replace `Model.findById()` with `SupabaseService.selectByColumn()`
5. Replace `Model.create()` with `SupabaseService.insert()`
6. Replace `Model.updateOne()` with `SupabaseService.update()`

---

## Testing Your Migration

```bash
# 1. Start backend
cd backend
npm start

# 2. Test signup flow
curl -X POST http://localhost:4000/api/v2/user/create-user \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# Should return: "Verification code sent to your email"

# 3. Verify email
curl -X POST http://localhost:4000/api/v2/user/verify-activation-code \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "verifyCode": "123456"}'

# Should return: "Email verified successfully"

# 4. Set password
curl -X POST http://localhost:4000/api/v2/user/set-password \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "MyPassword123"}'

# Should return: JWT token

# 5. Login
curl -X POST http://localhost:4000/api/v2/user/login-user \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "MyPassword123"}'

# Should return: JWT token + user data
```

---

## Troubleshooting

| Error                       | Solution                                               |
| --------------------------- | ------------------------------------------------------ |
| "SUPABASE_URL is undefined" | Add .env file with SUPABASE_URL and SUPABASE_ANON_KEY  |
| "Table does not exist"      | Run SQL schema migration in Supabase SQL Editor        |
| "user_email_key violation"  | Email already exists - use a different email           |
| "Connection timeout"        | Check firewall, add Supabase IP to whitelist if needed |
| "PGRST401"                  | Check SUPABASE_ANON_KEY is correct                     |

---

## Next: Migrate Other Controllers

After user controller works, migrate in this order:

1. Room controller (depends on user)
2. Payment controller
3. BillingCycle controller
4. Settlement controller
5. SupportTicket controller
6. Announcement controller
7. BugReport controller

Each follows the same pattern shown above.
