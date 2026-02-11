# Environment Variables Template for Supabase Migration

Copy this to your `.env` file and fill in your actual values.

## Supabase Configuration

```
# Supabase Project URL (from Supabase Dashboard -> Settings -> API)
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co

# Supabase Anonymous Key (from Supabase Dashboard -> Settings -> API)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key (for admin operations, keep private!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Existing Configuration (Keep These)

```
# Server Port
PORT=4000

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d

# Email Configuration
# Example using Gmail SMTP
SMTP_SERVICE=gmail
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@apartmentbilltracker.com

# Or use SendGrid
SENDGRID_API_KEY=SG.your-sendgrid-key

# Cloudinary (for image uploads)
CLOUDINARY_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Node Environment
NODE_ENV=development
```

## How to Get Supabase Credentials

### Step 1: Create Supabase Project

Visit https://supabase.com/dashboard

1. Click "New Project"
2. Enter project name (e.g., "apartment-bill-tracker")
3. Create secure database password
4. Select region closest to your users
5. Wait 2-3 minutes for provisioning

### Step 2: Get Credentials

1. Navigate to **Settings → API** in Supabase Dashboard
2. Copy **Project URL** → SUPABASE_URL
3. Copy **Anon Key** → SUPABASE_ANON_KEY
4. Copy **Service Role Key** → SUPABASE_SERVICE_ROLE_KEY (keep secret!)

### Step 3: Verify Connection

Run test after setting credentials:

```bash
cd backend
npm install @supabase/supabase-js
node test-supabase.js
```

Expected output:

```
========== SUPABASE MIGRATION TESTS ==========

Testing: Create User
✅ PASSED

Testing: Find User by Email
✅ PASSED

... (10 tests total)

========== TEST SUMMARY ==========
Passed: 10 | Failed: 0

✅ All tests passed! Supabase is properly configured.
```

---

## Migration Path

After setting up Supabase credentials:

1. **Install Dependencies**

   ```bash
   cd backend
   npm install @supabase/supabase-js
   ```

2. **Run Schema Migration**
   - Copy SQL from `SUPABASE_MIGRATION_GUIDE.md` Part 2, Step 2
   - Paste into Supabase SQL Editor
   - Execute

3. **Test Connection**

   ```bash
   node test-supabase.js
   ```

4. **Update app.js**
   - Remove MongoDB connection code
   - Supabase will initialize on-demand

5. **Switch User Routes** (in app.js)
   - From: `const userRoutes = require("./controller/user");`
   - To: `const userRoutes = require("./controller/user-supabase");`

6. **Test Endpoints**
   - Signup flow (3 steps)
   - Login
   - Password reset

7. **Migrate Other Controllers** (one by one)
   - Room operations
   - Payment operations
   - Billing operations
   - Etc.

---

## Security Notes

- **Never commit** `.env` or `SUPABASE_SERVICE_ROLE_KEY` to Git
- **Keep service key private** - it has full database access
- Use **row-level security (RLS)** for multi-tenant data
- Always **validate** and **sanitize** user input
- **Hash passwords** before storing (bcrypt is used)
- Consider upgrading to **Supabase Auth** later instead of custom JWT

---

## Troubleshooting

| Error                       | Solution                              |
| --------------------------- | ------------------------------------- |
| "SUPABASE_URL is undefined" | Add to .env: `SUPABASE_URL=...`       |
| "Table does not exist"      | Run SQL schema migration in Supabase  |
| "PGRST401 Unauthorized"     | Check SUPABASE_ANON_KEY is correct    |
| "Connection timeout"        | Check SUPABASE_URL format and network |
| "Duplicate key value"       | Email already exists in database      |
