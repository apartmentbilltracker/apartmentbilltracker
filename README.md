# PropertyFlow — Apartment Bill Tracker

A full-stack application for managing apartment bills, rooms, roommates, payments, reminders and support/announcements. This repository contains three main components:

- `backend` — Express API (Supabase + other services)
- `web` — Vite + React web frontend
- `mobile` — Expo React Native mobile app

---

## Table of contents

- [Project overview](#project-overview)
- [Key features](#key-features)
- [Architecture & repository layout](#architecture--repository-layout)
- [Tech stack](#tech-stack)
- [Quickstart (development)](#quickstart-development)
  - [Prerequisites](#prerequisites)
  - [Backend (API)](#backend-api)
  - [Web frontend](#web-frontend)
  - [Mobile app](#mobile-app)
- [Configuration & environment variables](#configuration--environment-variables)
- [Database & migrations](#database--migrations)
- [Known scripts & utilities](#known-scripts--utilities)
- [API overview (notable routes)](#api-overview-notable-routes)
- [CORS & deployment notes](#cors--deployment-notes)
- [Troubleshooting & tips](#troubleshooting--tips)
- [Contributing](#contributing)
- [License & maintainers](#license--maintainers)

---

## Project overview

PropertyFlow is designed to help property managers and tenants manage billing cycles, payments, reminders, announcements, support tickets, and in-app chat. The backend exposes a version check endpoint and many domain-specific endpoints (users, rooms, billing cycles, payments, announcements, reminders, chat, etc.). The mobile app and web frontend consume the API.

---

## Key features

- User authentication and account management
- Room and roommate management
- Billing cycles, invoices and payments
- Payment processing integration
- Announcements and support/bug reporting
- Notifications and in-app chat
- Admin financial / billing / reminders functionality
- File uploads (Cloudinary integration), PDF generation and emailing
- OTA / version check endpoint to force updates or notify users

---

## Architecture & repository layout

Top-level folders:
- `backend/` — Express API, migrations, migration utilities and controllers
- `web/` — React (Vite) web frontend
- `mobile/` — Expo React Native mobile app
- `.github/` — repository CI/issue templates (if present)
- `README/` — (present in the repo root)

Example of important backend files:
- `backend/app.js` — main Express app (routes, middleware, security, CORS, file upload settings, app-version endpoint)
- `backend/server.js` — server bootstrap (start script)
- `backend/controller/` — route controllers (many controller files)
- `backend/db/` — DB-related code (includes Supabase service)

Migrations & utilities:
- `backend/migrations/`
- migration helper scripts: `apply-migration.js`, `execute-migration.js`, `run-migration.js`, `run-migration-fixed.js`
- data migration scripts: e.g., `migrate-room.js`, `migrate-avatars.js`

---

## Tech stack

Backend:
- Node.js + Express
- Supabase (primary DB/service access via a `SupabaseService`)
- Postgres (pg), Mongoose also appears as a dependency (check usage)
- Cloudinary, SendGrid, Twilio, Nodemailer, pdfkit
- File uploads via express-fileupload
- Security: helmet, rate-limiter middleware, cookie-parser, compression

Web:
- React + Vite
- React Router
- TailwindCSS for styling (tailwind.config.js present)

Mobile:
- Expo (React Native)
- React Navigation
- Expo modules (notifications, secure store, image picker, location, etc.)

---

## Quickstart (development)

### Prerequisites
- Node.js (recommend current LTS)
- npm or yarn
- For mobile: Expo CLI (if testing on device/emulator)
- Supabase project (or other DB if used)
- Cloudinary account (for file uploads) and any 3rd-party service credentials you use (SendGrid, Twilio, SMTP, etc.)

Clone the repo:
```bash
git clone https://github.com/apartmentbilltracker/propertyflow.git
cd propertyflow
