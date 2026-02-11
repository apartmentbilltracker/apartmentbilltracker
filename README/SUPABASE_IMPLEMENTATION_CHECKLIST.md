# Supabase Migration - Implementation Checklist

Track your progress through the migration process.

## Phase 1: Preparation ⏳

- [ ] Read `SUPABASE_MIGRATION_GUIDE.md` completely
- [ ] Create Supabase account at https://supabase.com
- [ ] Create new Supabase project
- [ ] Note your SUPABASE_URL and SUPABASE_ANON_KEY
- [ ] Update `backend/.env` with credentials
- [ ] Review current MongoDB models in `backend/model/`

## Phase 2: Database Setup 🗄️

- [ ] Open Supabase SQL Editor
- [ ] Copy SQL schema from migration guide
- [ ] Execute schema migration
- [ ] Verify all tables created in Supabase Table Editor:
  - [ ] users
  - [ ] addresses
  - [ ] rooms
  - [ ] room_members
  - [ ] room_billing
  - [ ] billing_cycles
  - [ ] billing_cycle_charges
  - [ ] payments
  - [ ] settlements
  - [ ] support_tickets
  - [ ] support_ticket_responses
  - [ ] bug_reports
  - [ ] announcements
  - [ ] notification_logs
  - [ ] faqs
  - [ ] payment_transactions

## Phase 3: Backend Setup 💻

- [ ] Run `npm install @supabase/supabase-js` in backend directory
- [ ] Verify SupabaseClient.js created in `backend/db/`
- [ ] Verify SupabaseService.js created in `backend/db/`
- [ ] Verify user-supabase.js controller created
- [ ] Run `node test-supabase.js` to verify connection
- [ ] All tests should pass with ✅

## Phase 4: Authentication Migration 🔐

- [ ] Test 3-step signup flow:
  - [ ] POST `/api/v2/user/create-user` - Send activation code
  - [ ] POST `/api/v2/user/verify-activation-code` - Verify email
  - [ ] POST `/api/v2/user/set-password` - Complete signup
  - [ ] POST `/api/v2/user/login-user` - Login with credentials
- [ ] Test password reset:
  - [ ] POST `/api/v2/user/password-reset` - Request reset
  - [ ] POST `/api/v2/user/reset-password` - Use reset token
- [ ] Test user profile:
  - [ ] GET `/api/v2/user/me` - Get current user
  - [ ] PUT `/api/v2/user/update-profile` - Update profile
- [ ] Test resend verification:
  - [ ] POST `/api/v2/user/resend-verification` - Resend code

## Phase 5: User Controller Migration 👤

In `backend/app.js`:

- [ ] Replace MongoDB user model import
- [ ] Update to use Supabase user-supabase controller
- [ ] Remove MongoDB connection code
- [ ] Test all user endpoints with Supabase

## Phase 6: Room Controller Migration 🏠

File: `backend/controller/room.js`

- [ ] Create room-supabase.js version
- [ ] Convert all MongoDB queries to Supabase calls
- [ ] Test endpoints:
  - [ ] CREATE room
  - [ ] GET room details
  - [ ] GET user's rooms
  - [ ] UPDATE room
  - [ ] ADD room member
  - [ ] UPDATE room billing

## Phase 7: Payment Controller Migration 💳

File: `backend/controller/payment.js`

- [ ] Create payment-supabase.js version
- [ ] Convert payment operations
- [ ] Test endpoints:
  - [ ] CREATE payment
  - [ ] GET room payments
  - [ ] GET user payments
  - [ ] UPDATE payment

## Phase 8: Billing Cycle Controller Migration 📊

File: `backend/controller/billingCycle.js`

- [ ] Create billingCycle-supabase.js version
- [ ] Convert billing cycle operations
- [ ] Test endpoints:
  - [ ] CREATE billing cycle
  - [ ] GET active cycle
  - [ ] GET cycle history
  - [ ] CLOSE billing cycle

## Phase 9: Settlement Controller Migration ⚖️

- [ ] Create settlement operations in Supabase
- [ ] Test:
  - [ ] CREATE settlement
  - [ ] GET pending settlements
  - [ ] MARK settlement as paid

## Phase 10: Support/Admin Controllers 🎫

- [ ] Support ticket migration
- [ ] Bug report migration
- [ ] Announcement migration
- [ ] Notification migration
- [ ] FAQ data migration

## Phase 11: Testing & Validation ✅

### User Signup Flow

```bash
# 1. Create user (start signup)
curl -X POST http://localhost:4000/api/v2/user/create-user \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# 2. Verify code
curl -X POST http://localhost:4000/api/v2/user/verify-activation-code \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "activationCode": "123456"}'

# 3. Set password
curl -X POST http://localhost:4000/api/v2/user/set-password \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "MySecurePassword123"}'

# 4. Login
curl -X POST http://localhost:4000/api/v2/user/login-user \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "MySecurePassword123"}'
```

### Automated Tests

- [ ] All 18+ endpoints tested
- [ ] Mobile app signup still works
- [ ] Mobile app login still works
- [ ] Mobile app room creation works
- [ ] Mobile app payment submission works
- [ ] No console errors during tests
- [ ] Database relationships intact

## Phase 12: Production Preparation 🚀

- [ ] Set NODE_ENV=production
- [ ] Test with production Supabase project
- [ ] Set up row-level security (RLS) policies
- [ ] Configure email notifications
- [ ] Set up regular backups
- [ ] Implement rate limiting
- [ ] Test error handling
- [ ] Load testing (simulate multiple users)

## Phase 13: Deployment 📦

- [ ] Final code review
- [ ] Update documentation
- [ ] Create migration runbook
- [ ] Train team on new Supabase setup
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Keep MongoDB running parallel for 2 weeks as safety net

## Phase 14: Supabase Optimization (Optional) 🎯

- [ ] Set up real-time subscriptions for live updates
- [ ] Upgrade to Supabase Auth (instead of custom JWT)
- [ ] Set up automated backups
- [ ] Configure Supabase security (network restrictions)
- [ ] Set up monitoring and alerts
- [ ] Optimize database queries (indexes, etc.)

---

## Key Files Created

✅ `SUPABASE_MIGRATION_GUIDE.md` - Complete migration roadmap
✅ `SUPABASE_QUICK_START.md` - Phase-by-phase implementation
✅ `SUPABASE_ENV_TEMPLATE.md` - Environment variable setup
✅ `backend/db/SupabaseClient.js` - Supabase connection initialization
✅ `backend/db/SupabaseService.js` - Database operations layer
✅ `backend/controller/user-supabase.js` - Authentication endpoints
✅ `backend/test-supabase.js` - Connection test suite
✅ `SUPABASE_IMPLEMENTATION_CHECKLIST.md` - This file

---

## Support

If you encounter issues:

1. Check `SUPABASE_MIGRATION_GUIDE.md` troubleshooting section
2. Run `node test-supabase.js` to diagnose connection issues
3. Review Supabase documentation: https://supabase.com/docs
4. Check environment variables in `.env`
5. Verify SQL schema in Supabase Table Editor
