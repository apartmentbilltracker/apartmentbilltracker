# Supabase Migration Guide

Complete step-by-step guide to migrate Apartment Bill Tracker backend from MongoDB to Supabase (PostgreSQL).

## Overview

**Current Stack:**

- Database: MongoDB with Mongoose ODM
- Server: Node.js + Express.js
- Authentication: Custom JWT + Bcrypt
- Email: Nodemailer + SendGrid

**Target Stack:**

- Database: Supabase (PostgreSQL)
- Server: Node.js + Express.js (unchanged)
- Authentication: Custom JWT + Bcrypt (can upgrade to Supabase Auth later)
- Email: Nodemailer + SendGrid (unchanged)
- Real-time: Supabase real-time subscriptions (optional enhancement)

---

## Part 1: Data Model Mapping

### Current MongoDB Collections → PostgreSQL Tables

#### 1. **users**

```
MongoDB Collection: User
Fields:
- _id (ObjectId)
- username (String)
- name (String)
- email (String, unique)
- password (String, hashed)
- phoneNumber (Number, unique, sparse)
- gender (String: male/female/other)
- dateOfBirth (Date)
- addresses (Array of Objects) → Separate 'addresses' table
- role (String: admin/client)
- isAdmin (Boolean)
- createdAt (Date)
- updatedAt (Date)
- isDeleted (Boolean)
- deletedAt (Date)

PostgreSQL Table: users
- id UUID PRIMARY KEY
- username TEXT UNIQUE
- name TEXT
- email TEXT UNIQUE NOT NULL
- password_hash TEXT
- phone_number BIGINT UNIQUE
- gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other'))
- date_of_birth DATE
- role VARCHAR(20) DEFAULT 'client'
- is_admin BOOLEAN DEFAULT false
- is_deleted BOOLEAN DEFAULT false
- deleted_at TIMESTAMP
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 2. **addresses**

```
New table (splitting from users.addresses)

PostgreSQL Table: addresses
- id UUID PRIMARY KEY
- user_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- name TEXT NOT NULL
- phone TEXT NOT NULL
- region TEXT NOT NULL
- province TEXT NOT NULL
- city TEXT NOT NULL
- barangay TEXT NOT NULL
- street TEXT NOT NULL
- house_number TEXT NOT NULL
- zip_code INTEGER NOT NULL
- address_type VARCHAR(20) CHECK (address_type IN ('Home', 'Work', 'Default'))
- is_default BOOLEAN DEFAULT false
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 3. **rooms**

```
MongoDB Collection: Room
Fields:
- _id (ObjectId)
- name (String)
- code (String, unique)
- description (String)
- createdBy (ObjectId ref:User)
- members (Array with user refs) → Separate 'room_members' table
- billing (Object) → Denormalized or separate 'room_billing'
- memberPayments (Array) → Track in payments/settlement tables
- billingHistory (Array) → Historical records

PostgreSQL Table: rooms
- id UUID PRIMARY KEY
- name TEXT NOT NULL
- code TEXT UNIQUE NOT NULL
- description TEXT
- created_by UUID FOREIGN KEY REFERENCES users(id)
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 4. **room_members**

```
Junction table for many-to-many relationship

PostgreSQL Table: room_members
- id UUID PRIMARY KEY
- room_id UUID FOREIGN KEY REFERENCES rooms(id) ON DELETE CASCADE
- user_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- name TEXT
- is_payer BOOLEAN DEFAULT true
- joined_at TIMESTAMP DEFAULT NOW()
- presence JSON (Array of ISO date strings for current billing period)
- UNIQUE(room_id, user_id)
```

#### 5. **room_billing**

```
Current billing state for a room

PostgreSQL Table: room_billing
- id UUID PRIMARY KEY
- room_id UUID FOREIGN KEY REFERENCES rooms(id) ON DELETE CASCADE
- billing_start DATE
- billing_end DATE
- rent DECIMAL(10, 2)
- electricity DECIMAL(10, 2)
- water DECIMAL(10, 2)
- internet DECIMAL(10, 2)
- previous_reading DECIMAL(10, 2)
- current_reading DECIMAL(10, 2)
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 6. **billing_cycles**

```
MongoDB Collection: BillingCycle
Fields:
- _id (ObjectId)
- room (ObjectId ref:Room)
- cycleNumber (Number)
- startDate (Date)
- endDate (Date)
- status (String: active/completed/archived)
- createdBy (ObjectId ref:User)
- closedAt (Date)
- closedBy (ObjectId ref:User)
- totalBilledAmount (Number)
- membersCount (Number)
- billBreakdown (Object)
- memberCharges (Array) → Separate 'billing_cycle_charges' table

PostgreSQL Table: billing_cycles
- id UUID PRIMARY KEY
- room_id UUID FOREIGN KEY REFERENCES rooms(id) ON DELETE CASCADE
- cycle_number INTEGER NOT NULL
- start_date DATE NOT NULL
- end_date DATE NOT NULL
- status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'))
- created_by UUID FOREIGN KEY REFERENCES users(id)
- closed_at TIMESTAMP
- closed_by UUID FOREIGN KEY REFERENCES users(id)
- total_billed_amount DECIMAL(10, 2) DEFAULT 0
- members_count INTEGER DEFAULT 0
- rent DECIMAL(10, 2)
- electricity DECIMAL(10, 2)
- water_bill_amount DECIMAL(10, 2)
- internet DECIMAL(10, 2)
- previous_meter_reading DECIMAL(10, 2)
- current_meter_reading DECIMAL(10, 2)
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 7. **billing_cycle_charges**

```
Member charges for a specific billing cycle

PostgreSQL Table: billing_cycle_charges
- id UUID PRIMARY KEY
- billing_cycle_id UUID FOREIGN KEY REFERENCES billing_cycles(id) ON DELETE CASCADE
- user_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- name TEXT
- is_payer BOOLEAN DEFAULT true
- presence_days INTEGER DEFAULT 0
- water_bill_share DECIMAL(10, 2) DEFAULT 0
- rent_share DECIMAL(10, 2) DEFAULT 0
- electricity_share DECIMAL(10, 2) DEFAULT 0
- internet_share DECIMAL(10, 2) DEFAULT 0
- total_due DECIMAL(10, 2) DEFAULT 0
- UNIQUE(billing_cycle_id, user_id)
```

#### 8. **payments**

```
MongoDB Collection: Payment
Fields:
- _id (ObjectId)
- room (ObjectId ref:Room)
- paidBy (ObjectId ref:User)
- amount (Number)
- billType (String: rent/electricity/water/total)
- paymentMethod (String: cash/bank_transfer/credit_card/e_wallet/other)
- paymentDate (Date)
- reference (String)
- notes (String)

PostgreSQL Table: payments
- id UUID PRIMARY KEY
- room_id UUID FOREIGN KEY REFERENCES rooms(id) ON DELETE CASCADE
- paid_by UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- amount DECIMAL(10, 2) NOT NULL
- billing_cycle_start DATE
- billing_cycle_end DATE
- bill_type VARCHAR(20) CHECK (bill_type IN ('rent', 'electricity', 'water', 'total'))
- payment_method VARCHAR(30) DEFAULT 'cash'
- payment_date TIMESTAMP DEFAULT NOW()
- reference TEXT
- notes TEXT
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 9. **settlements**

```
MongoDB Collection: Settlement
Fields:
- Tracks debts between roommates

PostgreSQL Table: settlements
- id UUID PRIMARY KEY
- room_id UUID FOREIGN KEY REFERENCES rooms(id) ON DELETE CASCADE
- debtor_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- creditor_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- amount DECIMAL(10, 2) NOT NULL
- billing_cycle_start DATE
- billing_cycle_end DATE
- status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'partial'))
- settlement_date TIMESTAMP
- settlement_amount DECIMAL(10, 2) DEFAULT 0
- notes TEXT
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 10. **support_tickets**

```
MongoDB Collection: SupportTicket

PostgreSQL Table: support_tickets
- id UUID PRIMARY KEY
- user_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- user_name TEXT NOT NULL
- user_email TEXT NOT NULL
- subject TEXT NOT NULL
- message TEXT NOT NULL
- status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed'))
- priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'))
- category VARCHAR(30) DEFAULT 'general' CHECK (category IN ('billing', 'payment', 'technical', 'general', 'other'))
- room_id UUID FOREIGN KEY REFERENCES rooms(id) ON DELETE SET NULL
- responses JSON (Array of response objects)
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 11. **support_ticket_responses**

```
Separate table for ticket responses

PostgreSQL Table: support_ticket_responses
- id UUID PRIMARY KEY
- ticket_id UUID FOREIGN KEY REFERENCES support_tickets(id) ON DELETE CASCADE
- responder_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- responder_name TEXT NOT NULL
- response_text TEXT NOT NULL
- response_time TIMESTAMP DEFAULT NOW()
```

#### 12. **bug_reports**

```
PostgreSQL Table: bug_reports
- id UUID PRIMARY KEY
- user_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- user_name TEXT NOT NULL
- user_email TEXT NOT NULL
- app_version TEXT
- device_info TEXT
- title TEXT NOT NULL
- description TEXT NOT NULL
- screenshot_urls JSON (Array of URLs)
- status VARCHAR(20) DEFAULT 'open'
- priority VARCHAR(20) DEFAULT 'medium'
- assigned_to UUID FOREIGN KEY REFERENCES users(id) ON DELETE SET NULL
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 13. **announcements**

```
PostgreSQL Table: announcements
- id UUID PRIMARY KEY
- room_id UUID FOREIGN KEY REFERENCES rooms(id) ON DELETE CASCADE
- created_by UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- title TEXT NOT NULL
- content TEXT NOT NULL
- image_url TEXT
- is_pinned BOOLEAN DEFAULT false
- pin_priority INTEGER
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 14. **notification_logs**

```
PostgreSQL Table: notification_logs
- id UUID PRIMARY KEY
- user_id UUID FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
- room_id UUID FOREIGN KEY REFERENCES rooms(id) ON DELETE SET NULL
- notification_type VARCHAR(50)
- title TEXT
- message TEXT
- data JSON
- is_read BOOLEAN DEFAULT false
- created_at TIMESTAMP DEFAULT NOW()
```

#### 15. **faqs**

```
PostgreSQL Table: faqs
- id UUID PRIMARY KEY
- category VARCHAR(50)
- question TEXT NOT NULL
- answer TEXT NOT NULL
- order_index INTEGER
- is_active BOOLEAN DEFAULT true
- created_at TIMESTAMP DEFAULT NOW()
- updated_at TIMESTAMP DEFAULT NOW()
```

#### 16. **payment_transactions**

```
PostgreSQL Table: payment_transactions
- id UUID PRIMARY KEY
- payment_id UUID FOREIGN KEY REFERENCES payments(id) ON DELETE CASCADE
- transaction_id TEXT
- status VARCHAR(30)
- amount DECIMAL(10, 2)
- response_data JSON
- created_at TIMESTAMP DEFAULT NOW()
```

---

## Part 2: Step-by-Step Migration Implementation

### Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up
2. Create a new project
3. Choose PostgreSQL as database
4. Save your project URL and anon key
5. Note your database password (you'll need it for migrations)

### Step 2: Create PostgreSQL Schema

Create SQL Migration File: `supabase-migrations/001_initial_schema.sql`

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  phone_number BIGINT UNIQUE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE,
  role VARCHAR(20) DEFAULT 'client',
  is_admin BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Addresses table
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  region TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  barangay TEXT NOT NULL,
  street TEXT NOT NULL,
  house_number TEXT NOT NULL,
  zip_code INTEGER NOT NULL,
  address_type VARCHAR(20) CHECK (address_type IN ('Home', 'Work', 'Default')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Room members (many-to-many)
CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  is_payer BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT NOW(),
  presence JSONB DEFAULT '[]',
  UNIQUE(room_id, user_id)
);

-- Current room billing state
CREATE TABLE room_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  billing_start DATE,
  billing_end DATE,
  rent DECIMAL(10, 2),
  electricity DECIMAL(10, 2),
  water DECIMAL(10, 2),
  internet DECIMAL(10, 2),
  previous_reading DECIMAL(10, 2),
  current_reading DECIMAL(10, 2),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Billing cycles
CREATE TABLE billing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID REFERENCES users(id),
  closed_at TIMESTAMP,
  closed_by UUID REFERENCES users(id),
  total_billed_amount DECIMAL(10, 2) DEFAULT 0,
  members_count INTEGER DEFAULT 0,
  rent DECIMAL(10, 2),
  electricity DECIMAL(10, 2),
  water_bill_amount DECIMAL(10, 2),
  internet DECIMAL(10, 2),
  previous_meter_reading DECIMAL(10, 2),
  current_meter_reading DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Billing cycle member charges
CREATE TABLE billing_cycle_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_cycle_id UUID REFERENCES billing_cycles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  is_payer BOOLEAN DEFAULT true,
  presence_days INTEGER DEFAULT 0,
  water_bill_share DECIMAL(10, 2) DEFAULT 0,
  rent_share DECIMAL(10, 2) DEFAULT 0,
  electricity_share DECIMAL(10, 2) DEFAULT 0,
  internet_share DECIMAL(10, 2) DEFAULT 0,
  total_due DECIMAL(10, 2) DEFAULT 0,
  UNIQUE(billing_cycle_id, user_id)
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  billing_cycle_start DATE,
  billing_cycle_end DATE,
  bill_type VARCHAR(20) CHECK (bill_type IN ('rent', 'electricity', 'water', 'total')),
  payment_method VARCHAR(30) DEFAULT 'cash',
  payment_date TIMESTAMP DEFAULT NOW(),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Settlements
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  debtor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  creditor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  billing_cycle_start DATE,
  billing_cycle_end DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'partial')),
  settlement_date TIMESTAMP,
  settlement_amount DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Support tickets
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category VARCHAR(30) DEFAULT 'general' CHECK (category IN ('billing', 'payment', 'technical', 'general', 'other')),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Support ticket responses
CREATE TABLE support_ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES users(id) ON DELETE CASCADE,
  responder_name TEXT NOT NULL,
  response_text TEXT NOT NULL,
  response_time TIMESTAMP DEFAULT NOW()
);

-- Bug reports
CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  app_version TEXT,
  device_info TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_urls JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN DEFAULT false,
  pin_priority INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notification logs
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  notification_type VARCHAR(50),
  title TEXT,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- FAQs
CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment transactions
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  transaction_id TEXT,
  status VARCHAR(30),
  amount DECIMAL(10, 2),
  response_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_room_members_user ON room_members(user_id);
CREATE INDEX idx_billing_cycles_room ON billing_cycles(room_id);
CREATE INDEX idx_payments_room ON payments(room_id);
CREATE INDEX idx_payments_paid_by ON payments(paid_by);
CREATE INDEX idx_settlements_room ON settlements(room_id);
CREATE INDEX idx_settlements_debtor ON settlements(debtor_id);
CREATE INDEX idx_settlements_creditor ON settlements(creditor_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_announcements_room ON announcements(room_id);
CREATE INDEX idx_payment_transactions_payment ON payment_transactions(payment_id);
```

### Step 3: Install Supabase SDK

In backend directory:

```bash
npm install @supabase/supabase-js
```

### Step 4: Create Supabase Database Client Wrapper

Create file: `db/SupabaseClient.js`

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

### Step 5: Update Environment Variables

In `.env` file, add:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 6: Create Custom Supabase Service Layer

Create file: `db/SupabaseHelper.js` with query builder functions:

```javascript
const supabase = require("./SupabaseClient");

// User operations
const UserService = {
  async findByEmail(email) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  async create(user) {
    const { data, error } = await supabase
      .from("users")
      .insert([user])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// Room operations
const RoomService = {
  async create(room) {
    const { data, error } = await supabase
      .from("rooms")
      .insert([room])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async findByCode(code) {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from("rooms")
      .select(
        `
        *,
        room_members(*),
        room_billing(*)
      `,
      )
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  async addMember(roomId, userId, name, isPayer = true) {
    const { data, error } = await supabase
      .from("room_members")
      .insert([
        {
          room_id: roomId,
          user_id: userId,
          name,
          is_payer: isPayer,
          joined_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// Payment operations
const PaymentService = {
  async create(payment) {
    const { data, error } = await supabase
      .from("payments")
      .insert([payment])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async findByRoom(roomId) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("room_id", roomId)
      .order("payment_date", { ascending: false });
    if (error) throw error;
    return data;
  },
};

module.exports = {
  UserService,
  RoomService,
  PaymentService,
  supabase,
};
```

---

## Part 3: Migrating Controllers

Convert Mongoose/MongoDB queries to Supabase queries

### Example: User Creation Controller

**Before (MongoDB):**

```javascript
const User = require("../model/user");

exports.createUser = async (req, res) => {
  const { email, name } = req.body;
  const user = await User.create({ email, name });
  res.status(201).json({ success: true, user });
};
```

**After (Supabase):**

```javascript
const { UserService } = require("../db/SupabaseHelper");

exports.createUser = async (req, res) => {
  const { email, name } = req.body;
  const user = await UserService.create({ email, name });
  res.status(201).json({ success: true, user });
};
```

---

## Part 4: Testing Checklist

- [ ] All 18+ endpoints tested with Supabase
- [ ] User authentication works (signup, login, verify code)
- [ ] Room operations work (create, join, update billing)
- [ ] Payment tracking works
- [ ] Settlement calculations work
- [ ] Support tickets work
- [ ] Email notifications work
- [ ] Data relationships intact
- [ ] Mobile app connects successfully

---

## Part 5: Data Migration Script (Optional)

If you have existing MongoDB data, create a migration script to transfer it to PostgreSQL/Supabase.

```javascript
// scripts/migrateData.js
const mongoose = require("mongoose");
const { supabase } = require("../db/SupabaseHelper");
const User = require("../model/user");

async function migrateUsers() {
  try {
    console.log("Starting user migration...");
    const mongoUsers = await User.find();

    for (const user of mongoUsers) {
      const pgUser = {
        id: user._id.toString(), // Or generate new UUID
        username: user.username,
        name: user.name,
        email: user.email,
        password_hash: user.password,
        phone_number: user.phoneNumber,
        gender: user.gender,
        date_of_birth: user.dateOfBirth,
        role: user.role,
        is_admin: user.isAdmin,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      };

      await supabase.from("users").insert([pgUser]);
    }
    console.log("User migration complete!");
  } catch (error) {
    console.error("Migration error:", error);
  }
}
```

---

## Rollback Plan

If you need to rollback:

1. Keep MongoDB running in parallel during transition
2. Test Supabase thoroughly before dropping MongoDB
3. Keep MongoDB backups for 30 days post-migration
4. Document any custom migration scripts

---

## Next Steps

1. **Immediate**: Create Supabase project and run schema SQL
2. **Week 1**: Install SDK, create client wrapper, test connections
3. **Week 2**: Migrate controllers one-by-one, test each endpoint
4. **Week 3**: Full end-to-end testing with mobile app
5. **Week 4**: Deploy to production, monitor for issues
