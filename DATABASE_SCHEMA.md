# LIS 815 LMS — Database Blueprint

Design the Supabase PostgreSQL schema around these entities:

- profiles
- roles / user_roles
- courses
- modules
- chapters
- lessons
- lesson_resources
- enrollments
- lesson_progress
- lesson_completion_events
- question_banks
- questions
- question_options
- objective_attempts
- objective_answers
- theory_exams
- theory_questions
- theory_attempts
- theory_answers
- theory_grades
- practical_activities
- practical_submissions
- glossary_terms
- bookmarks
- learner_notes
- certificates
- audit_logs
- notifications

## Important relationships
Course -> Modules -> Chapters -> Lessons.
Learner -> Enrollment -> Progress -> Assessment Attempts.

## Security
Use Supabase RLS on every user-facing table. Students can read published course material and their own records only. Admins can manage assigned course content. Superadmins can manage the whole platform.

## Integrity
Use unique constraints for enrollment/course and learner/lesson progress. Use transactions or RPC/database functions for assessment submission and progression state changes where atomicity matters.
