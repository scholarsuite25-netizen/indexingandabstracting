# OPENCODE MASTER BUILD PROMPT — LIS 815 INDEXING AND ABSTRACTING FIRST-CLASS LMS

You are the lead product architect, senior full-stack engineer, instructional designer, assessment designer, UX/UI designer, database architect, security engineer, QA engineer and DevOps engineer. Build a production-ready, visually rich but simple-to-use LMS for the course **LIS 815 — Indexing and Abstracting**.

The requester is a non-coder. Therefore, do not make the requester manually write code. Automate configuration wherever possible, provide clear setup screens/instructions, seed the database, validate environment variables, and make the project deployable with a zero-cost-oriented architecture.

## 1. SOURCE MATERIALS — AUTHORITATIVE BASIS
The `docs/` folder contains three supplied PDFs:
1. `Indexing_and_Abstracting_Complete_Ebook.pdf`
2. `LIS_814_Objective_Examination.pdf` (use the supplied file as provided, while the LMS course identity remains LIS 815)
3. `LIS_814_Theory_Examination.pdf` (use the supplied file as provided, while the LMS course identity remains LIS 815)

Read all three before generating course content or assessment data. Preserve the source terminology, structure and assessment intent. Do not silently invent answers where the source does not support them. Where expanded material is added, clearly mark it as **Supplementary Enrichment** rather than presenting it as part of the supplied course text.

The core supplied course structure is 7 modules / 14 chapters:
- Module 1: Theoretical Foundations and Types of Indexes
  - Ch 1 Fundamentals and Objectives of Subject Indexing
  - Ch 2 Types of Indexes and Book Indexing
  - Ch 3 Semantics and Syntax in Assigned Indexing
- Module 2: Vocabulary Control
  - Ch 4 Thesaurus Construction: Design and Term Selection
  - Ch 5 Thesaurus Construction: Structure and Maintenance
- Module 3: Pre-Coordinate Indexing Systems
  - Ch 6 Classic Pre-Coordinate Techniques
  - Ch 7 Permuted and Algorithmic Systems
- Module 4: Post-Coordinate and Derived Indexing
  - Ch 8 Post-Coordinate Indexing Systems
  - Ch 9 Search Strategies and Derived Indexing
- Module 5: Performance Evaluation and System Metrics
  - Ch 10 Evaluation Methodologies
  - Ch 11 Precision, Recall and Search Optimisation
- Module 6: Abstracting Principles and Applications
  - Ch 12 Abstracting Techniques and Types
  - Ch 13 Uses and Applications of Abstracts
- Module 7: Digital, Automated and AI-Assisted Indexing
  - Ch 14 Automatic Indexing, Computer-Assisted Tools and Artificial Intelligence

Also include supplied appendices: practical exercises, revision questions/model answers, glossary, assessment/examination guide and final revision checklist.

## 2. ENRICH THE COURSE BEYOND THE SUPPLIED MATERIAL
Expand the LMS academically without overwriting the supplied content. Add a separate enrichment layer covering useful topics such as:
- Information retrieval fundamentals and the indexing/search relationship
- Metadata and Dublin Core concepts
- MARC/MARC 21 orientation and library metadata workflows
- Library discovery systems, OPACs and discovery layers
- Authority control and name/subject authority concepts
- Controlled vocabularies beyond thesauri: subject headings, taxonomies, ontologies and classification systems
- Faceted classification and faceted search
- Citation indexing and citation databases
- Web indexing and enterprise search
- Full-text indexing and inverted indexes
- Tokenisation, stop words, stemming and lemmatisation
- Named entity recognition and entity-based retrieval
- Knowledge graphs and semantic search
- Search ranking and relevance feedback
- Information retrieval measures beyond precision/recall: F-measure, MAP, NDCG and user-oriented evaluation, taught at an appropriate LIS level
- Abstract quality, structured abstracts and informative/indicative/critical abstracts
- Scholarly communication, research discovery and literature review support
- AI-assisted indexing and abstracting workflows
- Generative AI risks: hallucination, bias, copyright, provenance, privacy and human verification
- Human-in-the-loop workflows and quality assurance
- OCR and indexing of scanned documents
- Multilingual and cross-language information retrieval
- Accessibility and inclusive information discovery
- Digital preservation/searchability considerations
- Practical Nigerian/African information-resource examples where appropriate
- Career pathways and practical workplace applications for indexing and abstracting professionals

Do not let enrichment obscure the examinable core. Clearly label supplementary sections.

## 3. LEARNING EXPERIENCE
Create a modern, responsive, mobile-first academic LMS with:
- Dashboard
- Course overview
- Module/lesson navigation
- Reading progress
- Completion indicators
- Search across course content
- Bookmarks/favourites
- Notes
- Glossary
- Downloadable/print-friendly learning resources
- Announcements
- Assessment centre
- Results/history
- Profile/settings
- Help/FAQ

Use a calm academic visual system: strong typography, excellent spacing, cards, progress rings/bars, clear status badges and accessible contrast. Avoid clutter and excessive animation.

## 4. STRICT SEQUENTIAL PROGRESSION ENGINE
This is a core business rule.

A learner cannot move to the next lesson/section until the current lesson is genuinely completed.

Implement:
- lesson status: locked / available / in_progress / completed
- required reading percentage configurable by admin, default 90–100%
- track meaningful reading activity rather than relying only on a button click
- minimum time-on-content configurable by admin, but do not use time alone as proof of learning
- explicit “Mark as completed” only after reading requirements are satisfied
- next lesson remains locked until completion is recorded server-side
- resume from last position
- module completion
- course completion
- prerequisite graph capable of supporting future branching courses
- prevent client-side manipulation of completion flags
- server/database validation and RLS

## 5. OBJECTIVE ASSESSMENT
Use the supplied objective examination as the authoritative question bank.

Implement:
- 100 MCQs
- 4 options A-D
- one correct answer
- 1 mark each
- 100 total marks
- configurable timer; source states 1 hour 30 minutes, so default to 90 minutes
- autosave answers
- resume policy configurable
- question navigation
- unanswered-question warning
- submit confirmation
- automatic marking
- score percentage
- detailed result report
- attempt history
- configurable maximum attempts
- question randomisation and option randomisation as admin settings, while preserving answer correctness
- anti-cheating-friendly design without invasive surveillance

Default rule:
**70% or higher is the pass threshold.**
A learner scoring 70% or higher may unlock the theory examination. Scores below 70% should show targeted revision guidance and the configured retake policy.

Do not hard-code this in UI only; enforce it in database/server logic.

## 6. THEORY EXAMINATION
Implement the supplied theory examination as a controlled assessment:
- 7 questions
- learner must answer exactly 5
- each selected question carries 20 marks
- maximum 100 marks
- 2 hours default
- question-selection interface
- rich text answer editor
- autosave drafts
- final submission lock
- lecturer/admin grading workflow
- rubric/marking guide support
- per-question score and feedback
- total score
- grader identity and timestamp
- moderation/status workflow: draft / submitted / under_review / graded / released

The supplied model answers are indicative, not exhaustive. Preserve that principle.

## 7. ADD A PRACTICAL LAB LAYER
Create optional practical activities that do not alter the supplied examination:
- Create a mini index for a supplied passage
- Identify concepts and preferred terms
- Build a small thesaurus with BT/NT/RT/USE/UF relationships
- Compare pre-coordinate and post-coordinate approaches
- Calculate precision/recall/fallout
- Write informative, indicative and structured abstracts
- Design a search strategy
- Evaluate search results
- Inspect an AI-generated index/abstract and correct errors
- Create a metadata record
- Build a simple authority-control exercise
- Capstone: design an indexing/abstracting workflow for a Nigerian academic library

Provide model solutions or instructor rubrics where appropriate.

## 8. CERTIFICATE AND COMPLETION
Build certificate-ready architecture but make issuance configurable.
Potential completion conditions:
- required lessons complete
- objective assessment passed
- theory assessment graded and passed according to admin-configurable policy
- practical activities complete if enabled

Certificate fields:
- learner name
- course title
- completion date
- certificate number
- verification URL/QR code
- issuing institution/brand

Certificate verification must be public but reveal only necessary certificate information.

## 9. USER ROLES
Implement Supabase Authentication plus application-level authorization.

Roles:
1. Superadmin — full system control
2. Admin/Instructor — course/content/assessment/student management within assigned scope
3. Student/User — learning and assessments

Use secure role checks and Supabase Row Level Security. Never trust a role supplied by the browser.

## 10. DASHBOARDS
### Superadmin
- total users
- active learners
- course enrolments
- completion rate
- objective pass rate
- theory submissions awaiting grading
- recent activity
- assessment analytics
- user/role management
- course settings
- system settings
- audit logs

### Admin/Instructor
- assigned courses
- learners
- progress
- objective results
- theory grading queue
- practical submissions
- announcements
- content editor
- question bank
- reports/export

### Student
- continue learning
- current module
- progress
- locked/unlocked roadmap
- assessments
- results
- feedback
- certificates
- bookmarks/notes

## 11. DATABASE DESIGN — SUPABASE POSTGRES
Design normalized, maintainable tables including at minimum:
- profiles
- roles
- user_roles
- courses
- modules
- lessons
- lesson_sections
- lesson_prerequisites
- enrolments
- lesson_progress
- reading_events
- bookmarks
- notes
- glossary_terms
- resources
- announcements
- question_banks
- questions
- question_options
- objective_attempts
- objective_answers
- theory_exams
- theory_questions
- theory_attempts
- theory_answers
- practical_activities
- practical_submissions
- grades
- certificates
- certificate_verifications
- audit_logs
- app_settings

Use UUIDs, timestamps, foreign keys, indexes and appropriate constraints. Add soft-delete/archive fields where useful.

## 12. RLS AND SECURITY
Create comprehensive Supabase RLS policies.
Examples:
- Students can read published course content for enrolled courses.
- Students can read/write only their own progress, notes, bookmarks and draft answers.
- Students can read only their own results.
- Students cannot update their own scores, completion flags, role, certificate status or grading records.
- Admins can manage assigned course content and assessments.
- Superadmins can manage all records.
- Public users can verify certificates by secure certificate number/token only.

Use database functions/triggers where useful for protected transitions. Avoid insecure service-role usage in client code.

## 13. ADMIN CONTENT MANAGEMENT
Build a friendly CMS-like interface so a non-coder can:
- create/edit/archive modules and lessons
- reorder lessons
- publish/unpublish content
- upload resources
- manage glossary terms
- manage questions/options/answers
- configure exam settings
- set prerequisites
- review learner progress
- grade theory answers
- issue/revoke certificates

Use drafts and publish states.

## 14. ANALYTICS
Provide useful academic analytics:
- learner progress by module
- lesson completion bottlenecks
- average score
- pass/fail rate
- question difficulty
- option-selection distribution
- theory grading distribution
- assessment attempts
- completion time
- learner engagement trends

For question analytics calculate difficulty index and, where sample size permits, basic discrimination statistics. Explain these in admin help text.

## 15. ACCESSIBILITY
Target WCAG 2.2 AA principles:
- keyboard navigation
- visible focus states
- semantic HTML
- labels
- accessible forms
- sufficient contrast
- reduced-motion preference
- screen-reader-friendly status messages
- captions/transcripts for media
- no colour-only meaning

## 16. SEARCH
Implement fast course search using PostgreSQL full-text search initially. Do not add paid search services. Search:
- lessons
- glossary
- resources
- announcements

Show highlighted results and module context.

## 17. OFFLINE/LOW-BANDWIDTH FRIENDLINESS
Nigeria-friendly optimisation:
- responsive design
- compressed assets
- lazy loading
- minimal JavaScript where possible
- avoid autoplay video
- save progress reliably
- graceful network error states
- retry queues for non-critical writes
- print/download friendly content

Do not claim full offline support unless actually implemented and tested.

## 18. ZERO-COST DEPLOYMENT STRATEGY
Prioritise free tiers and open-source software.
Preferred architecture:
- Next.js + TypeScript
- Supabase free tier for Auth/Postgres/Storage where limits permit
- Vercel free tier for frontend/app hosting where permitted
- GitHub free repository
- Tailwind CSS
- shadcn/ui
- Lucide icons

Do not add paid APIs by default.
Do not require OpenAI/Anthropic/Gemini APIs for core LMS operation.
AI features should be optional and disabled unless an admin supplies a key.

Include a `COSTS.md` explaining what is free, likely limits, and what could incur charges. Never promise perpetual zero cost because third-party pricing and usage limits can change.

## 19. TECHNICAL QUALITY
Use:
- strict TypeScript
- reusable components
- server-side validation
- Zod or equivalent schema validation
- secure authentication flows
- error boundaries
- loading/skeleton states
- empty states
- toast/notification system
- structured logging
- environment validation
- migrations
- seed scripts
- automated tests

Avoid unnecessary libraries.

## 20. TESTING
Create tests for:
- authentication
- authorization
- RLS-sensitive operations
- lesson locking
- completion validation
- objective marking
- 70% threshold
- theory unlock
- exactly-five theory selection
- theory score calculation
- certificate eligibility
- certificate verification
- admin/student separation
- responsive critical flows

Include an end-to-end acceptance test:
Student registers → enrols → opens Module 1 → completes lesson → next lesson unlocks → completes all required learning → takes 100-question objective exam → scores 70%+ → theory unlocks → selects exactly 5 of 7 → submits → admin grades → certificate eligibility updates.

Also test failure paths: score 69%, attempting to skip lessons, tampering with completion, attempting to alter score, unauthorized admin routes, expired session, and direct API manipulation.

## 21. CONTENT PIPELINE
Create an importable structured content format such as JSON/Markdown for all 7 modules and 14 chapters. Keep supplied source content distinct from enrichment.

Create:
- `/content/core/` for source-derived content
- `/content/enrichment/` for supplementary content
- `/content/assessments/` for objective/theory/practical assessment data
- `/supabase/migrations/`
- `/supabase/seed/`

Build an importer/seed mechanism so content can be loaded into Supabase repeatably.

## 22. NO-CODER EXPERIENCE
Create a `START_HERE.md` with exact steps:
1. Install prerequisites.
2. Open project in OpenCode.
3. Create a free Supabase project.
4. Copy URL and anon key.
5. Configure environment variables.
6. Run database migrations.
7. Seed LIS 815 content.
8. Create the first Superadmin safely.
9. Run locally.
10. Push to GitHub.
11. Deploy to Vercel.
12. Add production environment variables.
13. Verify authentication, RLS and assessments.

Where possible, add scripts such as `npm run setup`, `npm run db:migrate`, `npm run db:seed`, `npm run test`, `npm run build`.

## 23. PROJECT DOCUMENTATION
Generate:
- README.md
- START_HERE.md
- ARCHITECTURE.md
- DATABASE.md
- SECURITY.md
- RLS.md
- ASSESSMENT_ENGINE.md
- CONTENT_MODEL.md
- DEPLOYMENT.md
- COSTS.md
- TEST_PLAN.md
- CHANGELOG.md

## 24. BUILD METHOD — DO NOT TRY TO DO EVERYTHING BLINDLY
Work in phases and keep the project runnable after each phase.

Phase 1: inspect source PDFs and extract a content inventory.
Phase 2: scaffold Next.js application.
Phase 3: implement Supabase Auth and profiles/roles.
Phase 4: implement database schema, migrations and RLS.
Phase 5: implement course/module/lesson UI and sequential progression.
Phase 6: import core course content.
Phase 7: implement objective exam and 70% gate.
Phase 8: implement theory exam and grading.
Phase 9: implement practical lab layer.
Phase 10: dashboards and analytics.
Phase 11: certificates and verification.
Phase 12: accessibility, low-bandwidth optimisation and polish.
Phase 13: comprehensive testing.
Phase 14: deployment documentation.

At every phase:
- run type checking
- run tests
- fix errors before proceeding
- preserve working features
- document important decisions

## 25. NON-CODER SAFETY RULE
If you encounter a decision that requires choosing between several technical approaches, choose the simplest secure approach that meets the requirement. Explain the decision in plain English in `DECISIONS.md`. Do not ask the requester to make unnecessary technical choices.

## 26. FINAL ACCEPTANCE CRITERIA
The build is not complete until:
- application starts successfully
- Supabase authentication works
- roles work
- RLS policies work
- course content loads
- sequential locking works server-side
- progress persists
- objective exam contains the supplied 100-question bank
- automatic marking works
- 70% threshold works
- theory exam contains 7 questions and enforces exactly 5 answers
- theory grading works
- dashboards work by role
- certificates can be verified
- tests pass
- production build passes
- documentation is complete
- no secret keys are committed
- no paid service is required for the core LMS

Start by inspecting the PDFs in `docs/`, produce a concise source/content inventory, then begin Phase 1 and continue through the phases without waiting for unnecessary confirmation. If a source contains ambiguity or inconsistency, preserve it, document it, and avoid silently changing it.
