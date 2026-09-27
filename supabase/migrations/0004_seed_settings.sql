-- LIS 815 LMS — 0004_seed_settings.sql
-- Idempotent seed: roles, permissions, and the platform settings table.
-- Values are documented defaults; the real values live in system_settings (admin-editable).

-- ============ Roles ============

insert into public.roles (code, name, description)
values
  ('superadmin', 'Super Administrator', 'Full control including role management'),
  ('admin', 'Administrator', 'Course, content, grading and platform administration'),
  ('student', 'Student', 'Enrolled learner')
on conflict (code) do nothing;

-- ============ Permissions ============

insert into public.permissions (code, description)
values
  ('content.publish', 'Create, edit and publish course content'),
  ('content.manage', 'Manage glossary, resources and practical activities'),
  ('assessment.grade', 'Grade theory examinations and practical submissions'),
  ('assessment.manage', 'Create and configure assessments and question banks'),
  ('user.manage', 'Manage user accounts and enrolments'),
  ('settings.manage', 'Edit platform settings'),
  ('certificate.issue', 'Issue and revoke certificates'),
  ('announcement.post', 'Post course announcements'),
  ('audit.view', 'View audit logs')
on conflict (code) do nothing;

-- ============ Role -> permission grants ============

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on true
where r.code in ('superadmin', 'admin')
on conflict do nothing;

-- Students hold no permissions; their access is enforced by RLS.

-- ============ Platform settings ============
-- jsonb values. Marked LMS default where the source PDFs do not specify one.

insert into public.system_settings (key, value, description, is_secret)
values
  ('course_code', '"LIS 815"', 'Official course code shown on certificates', false),
  ('course_title', '"Indexing and Abstracting"', 'Official course title', false),
  ('institution', '""', 'Institution name printed on certificates', false),
  ('theory_unlock_score', '70', 'Minimum objective-assessment percentage to unlock the theory exam (LMS default, not from source)', false),
  ('theory_pass_mark', '50', 'Theory pass mark out of 100 (LMS default, not from source)', false),
  ('objective_pass_mark', '50', 'Objective pass mark percentage (LMS default, not from source)', false),
  ('knowledge_check_pass_mark', '70', 'Default knowledge-check pass mark for lesson gating', false),
  ('reading_required_pct', '90', 'Percentage of a lesson that must be read before completion (LMS default, not from source)', false),
  ('retake_policy', '"unlimited"', 'Retake policy for assessments: unlimited or none. Best attempt counts (LMS default)', false),
  ('auto_issue_certificates', 'true', 'Issue certificates automatically when all criteria are met', false),
  ('certificate_prefix', '"LIS815"', 'Prefix used in certificate numbers', false),
  ('support_email', '""', 'Contact address shown on the Help page', false),
  ('maintenance_mode', 'false', 'When true, students see a maintenance message', false),
  ('analytics_enabled', 'false', 'Reserved: no third-party analytics are bundled', false)
on conflict (key) do nothing;

-- Secret example (kept empty): values marked is_secret are never returned by get_setting()
-- to non-admin users and are hidden from the settings table by RLS.
insert into public.system_settings (key, value, description, is_secret)
values ('email_api_key', '""', 'Reserved for future email delivery', true)
on conflict (key) do nothing;
