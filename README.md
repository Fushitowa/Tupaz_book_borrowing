# Nizel Library

Nizel Library is a modern book borrowing management system designed to make library operations more organized, efficient, and accessible. It provides a public customer portal for discovering books and managing borrowing requests, together with a secure staff portal for inventory and loan management.

## About the Project

I created Nizel Library with one main goal: to help my classmates. As someone who enjoys coding, I know that programming assignments and school projects can be challenging. I wanted to make a useful project that my classmates can learn from, try out, improve, and use for their own ideas.

This project started as a school project and also became a way for me to gain more experience. While building it, I learned how to work with React and TypeScript, connect a frontend to a Supabase database, manage users and roles, and build features that solve a real problem. I also practiced organizing the project, designing the customer and staff interfaces, and documenting what I built.

I believe that knowledge is more meaningful when it is shared. If this project helps a classmate understand an idea, finish a task, or become more confident in coding, then it has served its purpose. Nizel Library is not only a book borrowing system for me—it is also a record of what I have learned and how I continue to improve as a student and developer.

## Key Features

### Customer Portal
- Browse the book catalog and search for available titles
- Submit borrowing requests with delivery address and preferred loan period
- Receive a reference number to track request status
- Submit return notices for borrowed books

### Staff Portal
- Secure staff authentication with Supabase Auth
- Separate administrator and librarian responsibilities
- Manage books, categories, staff, and borrower records
- Review, approve, or reject borrowing requests
- Track active loans and due dates
- Process return requests and restore available inventory

### System Features
- Real-time Supabase database integration
- Role-based access control
- Automatic borrower and loan record handling
- Inventory copy tracking
- Responsive interface for desktop and mobile devices

## Technology Stack

- **Frontend:** React 18 and TypeScript
- **Build Tool:** Vite
- **Backend and Authentication:** Supabase
- **Database:** PostgreSQL
- **Edge Functions:** Supabase Functions
- **Styling:** CSS

## Project Structure

- `src/App.tsx` — selects the staff portal or customer website by Vite mode.
- `src/pages/` — contains the customer and staff portal pages.
- `src/components/` — contains reusable interface and setup components.
- `src/lib/` — initializes and manages the Supabase client.
- `src/types/` — contains shared TypeScript data types.
- `src/utils/` — contains shared formatting helpers.
- `supabase/schema.sql` — defines the database tables, relationships, policies, and functions.
- `supabase/functions/manage-librarian/` — contains the staff account management edge function.

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase account and project
- Supabase CLI, if staff account management will be deployed

### 1. Configure Supabase

Create a Supabase project, then open the SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). Running the script again can apply supported additive updates to an existing Nizel project.

### 2. Configure Environment Variables

Copy `.env.example` to `.env`, then add your project credentials:

```text
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Never place the Supabase service-role key in the browser or commit secrets to the repository.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Locally

Open two terminals in the project directory.

**Staff portal**

```bash
npm run dev:admin
```

Available at http://localhost:5173

**Public customer portal**

```bash
npm run dev:customer
```

Available at http://localhost:5174

The customer portal does not require login. Staff members sign in through the staff portal using Supabase Auth.

## Initial Staff Setup

On first use, open the staff portal and choose **First time here? Create the administrator account**.

- The first registered account receives the administrator role.
- Additional staff accounts must be created by an administrator.
- If email confirmation is enabled, confirm the account email before signing in.
- Administrators manage the catalog, categories, staff, and borrower records.
- Librarians process borrowing and return requests and manage loans.

To enable administrator creation of librarian accounts:

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy manage-librarian
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
```

The service-role key must remain on the server and must never be included in the frontend environment.

## How the Borrowing Workflow Works

1. A customer browses the public catalog and submits a borrowing request.
2. The request is assigned a unique reference number.
3. A staff member reviews the request.
4. Approval creates or updates the borrower record and creates an active loan.
5. One available copy is reserved for the approved loan.
6. Customers submit a return notice when returning a book.
7. Staff confirm the return, close the loan, and restore inventory availability.

Loan periods can be requested between 1 and 30 days, with 14 days as the default.

## Build for Production

Build the staff portal:

```bash
npm run build
```

Build the public customer portal:

```bash
npm run build:customer
```

## Purpose and Learning Outcomes

This project was developed to support classmates and school projects while strengthening practical software development skills. It provided experience with component-based frontend development, relational database design, authentication and roles, serverless functions, inventory workflows, and full application deployment.
