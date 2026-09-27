# LIS 815 LMS — Acceptance Tests

## Student
- Can register and sign in.
- Can see only published/enrolled content.
- Cannot open a locked lesson by manipulating the URL.
- Must complete the required reading/activity before the next lesson unlocks.
- Can take the objective exam when eligible.
- Receives an accurate score.
- Scores below 70% do not unlock theory.
- Scores 70% or above unlock theory.
- Can select exactly 5 of 7 theory questions.
- Cannot submit fewer or more than 5.
- Can view final results according to configured release policy.

## Admin
- Can manage learners assigned to the course.
- Can manage lessons/resources.
- Can create/edit objective questions.
- Can grade theory responses.
- Can review progress and attempts.

## Superadmin
- Can manage users, roles, courses, system settings and audit logs.

## Security
- RLS blocks cross-user access.
- Student cannot grant themselves admin privileges.
- Service-role secrets never reach the browser.
- Assessment scoring and eligibility cannot be falsified through client-side state.

## Quality
- Responsive on mobile, tablet and desktop.
- Keyboard navigable.
- Clear focus states.
- Accessible labels.
- Useful empty/loading/error states.
- No dead links or placeholder buttons in production views.
