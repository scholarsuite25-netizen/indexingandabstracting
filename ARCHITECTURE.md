# LIS 815 LMS — Architecture

## Purpose
A production-oriented, zero-cost-first Learning Management System for LIS 815: Indexing and Abstracting.

## Recommended stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + accessible component system
- Supabase Auth + PostgreSQL + Row Level Security
- Vercel free tier for deployment where suitable
- GitHub for version control
- No paid third-party service is required for core LMS operation

## Core domains
1. Authentication and profiles
2. Course/module/chapter/lesson content
3. Learner progress and sequential unlocking
4. Objective assessment
5. Theory assessment and manual grading
6. Practical laboratories
7. Glossary/search/bookmarks/notes
8. Analytics and reporting
9. Certificates and verification
10. Administration and audit logs

## Security principle
Never rely on client-side state for authorization, completion, examination eligibility, or grading. Enforce sensitive rules through Supabase RLS, database functions, and server-side application logic.

## UX principle
The interface must be usable by a non-technical administrator and a learner using a modest laptop or mobile phone with intermittent/slow connectivity.
