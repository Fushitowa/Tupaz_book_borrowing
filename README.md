# Nizel Library

A two-portal React + TypeScript book borrowing app backed by Supabase.

## Setup

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor. Run the updated script again in an existing Nizel project to add the borrower, loan, return request, and workflow functions.
2. Start the staff portal and choose **First time here? Create the administrator account**. The first registered account receives the admin role; later staff accounts can only be created by an admin. If email confirmation is enabled in Supabase Auth, confirm your address before signing in. To let admins create librarian accounts, link the Supabase CLI with `supabase link --project-ref YOUR-PROJECT-REF`, deploy `supabase functions deploy manage-librarian`, and set its `SUPABASE_SERVICE_ROLE_KEY` secret with `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`. Admins manage the catalog, categories, staff, and borrower records. Librarians process borrow requests and return notices, track loans, and record received books. The browser never receives the service role key.
3. Copy `.env.example` to `.env` and set your Supabase project URL and anon key. Never put a service-role key in the browser.
4. Run `npm install`.


## Source layout

- `src/App.tsx` selects the staff portal or customer website from the Vite mode.
- `src/pages/` contains the customer and staff portal pages.
- `src/components/` contains shared setup, statistics, and borrowing table components.
- `src/lib/` initializes Supabase; `src/types/` holds shared library data types.
- `src/utils/` contains small shared formatting helpers.

## Run locally

Open two terminals from this folder:

- Staff portal: `npm run dev:admin` → http://localhost:5173
- Public customer website: `npm run dev:customer` → http://localhost:5174

The customer site needs no login. Customers can browse titles, send borrowing requests with their address and requested loan length, and track request status by the returned reference. Customers can also send a return notice. Staff authenticate through Supabase Auth. Approval creates a borrower record and loan and reserves one copy; staff confirm returns to close the loan and restore availability. Loan periods may be requested for 1–30 days (14 days by default).

## Build

`npm run build` creates the staff build; `npm run build:customer` creates the public site build.
