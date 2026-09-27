# Security & Access Control (RLS)

This document outlines the security model for the LIS 815 LMS. 
The entire application relies on PostgreSQL Row-Level Security (RLS) enforced at the database level by Supabase.

## 1. Zero Trust Architecture
The Next.js application operates with a "Zero Trust" model towards the database. 
- The client-side application **cannot** read or write directly to the database without a valid JWT session.
- Even with a valid session, the database **does not trust** the client. Every read and write is intercepted by a Row-Level Security (RLS) policy that checks the `auth.uid()` against the requested row.

## 2. The Three Roles
Users are assigned one of three roles in the `profiles` table:
1. **Student**: The default role. Can only read public content and their own private data (notes, submissions).
2. **Admin**: Course instructors and graders. Can read all student submissions, grade papers, and manage content.
3. **Superadmin**: Platform owners. Can do everything an Admin can do, plus manage system settings and view audit logs.

## 3. Strict Data Isolation
- **Exams**: Students cannot read the `question_options` table directly. The `is_correct` boolean is strictly hidden. Exam marking happens inside a `SECURITY DEFINER` Postgres function that runs with elevated privileges, preventing students from intercepting the correct answers.
- **Grades**: Students cannot update their own `score` on the `theory_submissions` or `practical_submissions` tables. All updates must go through the admin grading functions.
- **Notes**: `user_id = auth.uid()` is strictly enforced on the `notes` and `bookmarks` tables.

## 4. Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Safe to expose.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Safe to expose. It only identifies the project to Supabase; RLS does the actual securing.
- `SUPABASE_SERVICE_ROLE_KEY`: **CRITICAL SECRET**. Never expose this in the browser or commit it to version control. It bypasses all RLS policies.
