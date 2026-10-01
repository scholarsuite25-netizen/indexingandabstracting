import Image from "next/image";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Layers,
  Lock,
  Search,
  Trophy,
  BookOpen,
  GraduationCap,
  Clock,
  ListChecks
} from "lucide-react";
import { Badge, ButtonLink, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import {
  ASSESSMENT_FACTS,
  COURSE,
  LEARNING_OUTCOMES,
  MODULES,
} from "@/lib/course";

const features = [
  {
    icon: Lock,
    title: "Guided progression",
    body: "Lessons unlock only once the required reading and knowledge checks are genuinely complete — recorded in the database, not just on screen.",
  },
  {
    icon: Search,
    title: "Search and glossary",
    body: "Full-text search across lessons, glossary, resources and announcements, plus a searchable course glossary of key terms.",
  },
  {
    icon: FileText,
    title: "Notes and bookmarks",
    body: "Keep private notes against lessons and bookmark anything you want to return to quickly.",
  },
  {
    icon: Trophy,
    title: "Results and certificates",
    body: "Automatic marking for the objective paper, released theory results, and a verifiable certificate when you qualify.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <SiteHeader />
      <main id="main" className="flex-1 pt-16">
        {/* HERO SECTION - Academic Blue Theme */}
        <section className="relative overflow-hidden bg-[#0B3A82] py-20 sm:py-32">
          {/* Subtle Abstract Pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M0 40L40 0H20L0 20M40 40V20L20 40" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            </svg>
          </div>
          
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
              <div className="flex flex-col items-start gap-6">
                <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-blue-100 backdrop-blur-sm">
                  <span className="flex h-2 w-2 rounded-full bg-blue-400 mr-2"></span>
                  Postgraduate Platform
                </div>
                
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {COURSE.code}
                  <span className="block text-blue-200 mt-2">{COURSE.title}</span>
                </h1>
                
                <p className="max-w-2xl text-lg leading-relaxed text-blue-100/90 sm:text-xl">
                  A professional course in indexing, abstracting and information organization. Master subject analysis, thesaurus construction, and AI-assisted indexing with automated grading and tracked progression.
                </p>
                
                <div className="mt-4 flex flex-wrap gap-4">
                  <ButtonLink href="/signup" variant="custom" size="lg" className="bg-white text-[#0B3A82] hover:bg-white/90 shadow-lg border-0 font-semibold px-8">
                    Start Learning
                    <ArrowRight className="ml-2 size-5" aria-hidden />
                  </ButtonLink>
                  <ButtonLink href="/login" variant="custom" size="lg" className="border border-white/30 text-white hover:bg-white/10 px-8">
                    Sign in
                  </ButtonLink>
                </div>
              </div>

              {/* Hero Image */}
              <div className="flex items-center justify-center lg:pl-10 relative">
                <Image src="/images/hero.jpg" alt="Knowledge Organization" width={600} height={600} className="rounded-3xl object-cover shadow-2xl border border-white/20" priority />
              </div>
            </div>
            
            {/* Course Statistics Cards moved below hero */}
            <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { value: "07", label: "Modules", icon: Layers },
                { value: "14", label: "Chapters", icon: BookOpen },
                { value: `${ASSESSMENT_FACTS.objective.questions}`, label: "Objective Questions", icon: ListChecks },
                { value: `${ASSESSMENT_FACTS.objective.durationMinutes}`, label: "Minutes", icon: Clock },
              ].map((stat) => (
                <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1">
                  <div className="absolute right-[-10px] top-[-10px] opacity-10 transition-transform group-hover:scale-110">
                    <stat.icon className="h-24 w-24 text-white" />
                  </div>
                  <p className="relative z-10 text-4xl font-bold text-white">{stat.value}</p>
                  <p className="relative z-10 mt-2 text-sm font-medium text-blue-200 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
            </div>
          </div>
        </section>

        {/* NEW FEATURES SECTION */}
        <section className="bg-white py-20" id="features">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
              <div>
                <Image src="/images/study.jpg" alt="Guided Progression" width={500} height={500} className="rounded-2xl mx-auto" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Guided Progression & Tracking</h2>
                <p className="text-lg text-slate-600 mb-6">Lessons unlock only once the required reading and knowledge checks are genuinely complete — recorded in the database, not just on screen.</p>
              </div>
            </div>
            
            <div className="grid gap-16 lg:grid-cols-2 lg:items-center mt-20">
              <div className="order-2 lg:order-1">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Full-Text Search & Glossary</h2>
                <p className="text-lg text-slate-600 mb-6">Experience blazing-fast search across lessons, glossary, resources, and announcements, plus a searchable course glossary of key terms.</p>
              </div>
              <div className="order-1 lg:order-2">
                <Image src="/images/search.jpg" alt="Search and Discovery" width={500} height={500} className="rounded-2xl mx-auto" />
              </div>
            </div>
          </div>
        </section>

        {/* LEARNING OBJECTIVES - Structured Grid */}
        <section className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6" id="outcomes">
          <div className="mb-12 text-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#0B3A82]">Learning Outcomes</h2>
            <h3 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">What you will be able to do</h3>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Master the core competencies required for professional information organization.
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {LEARNING_OUTCOMES.map((outcome, index) => (
              <div key={index} className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0B3A82]/10">
                  <CheckCircle2 className="h-6 w-6 text-[#0B3A82]" aria-hidden />
                </div>
                <p className="text-sm font-medium leading-relaxed text-slate-700">{outcome}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COURSE CURRICULUM - Visually Impressive */}
        <section className="bg-slate-50 py-20 border-y border-slate-200" id="modules">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#0B3A82]">Curriculum</h2>
              <h3 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Course Structure</h3>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                Seven comprehensive modules containing fourteen chapters of core reading, knowledge checks, and practicals.
              </p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
              {MODULES.map((module) => (
                <div key={module.position} className="flex flex-col rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden transition-all hover:shadow-lg">
                  <div className="bg-[#0B3A82]/5 p-6 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center rounded-full bg-[#0B3A82] px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
                        Module {String(module.position).padStart(2, '0')}
                      </span>
                      <span className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <BookOpen className="mr-1.5 h-4 w-4" />
                        {module.chapters.length} {module.chapters.length === 1 ? "Chapter" : "Chapters"}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 leading-tight mb-2">{module.title}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{module.summary}</p>
                  </div>
                  <div className="p-6">
                    <ul className="space-y-4">
                      {module.chapters.map((chapter) => (
                        <li key={chapter.position} className="flex items-start gap-3 group">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 group-hover:bg-[#0B3A82] group-hover:text-white transition-colors">
                            {chapter.position}
                          </div>
                          <span className="text-sm font-medium text-slate-700 pt-0.5 group-hover:text-[#0B3A82] transition-colors">{chapter.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ASSESSMENT INFO */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" id="assessment">
          <div className="mb-12 text-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#0B3A82]">Evaluation</h2>
            <h3 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">How assessment works</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <ClipboardCheck className="h-7 w-7 text-[#0B3A82]" />
              </div>
              <h4 className="mb-4 text-xl font-bold text-slate-900">Objective Exam</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> {ASSESSMENT_FACTS.objective.questions} questions, one correct answer</li>
                <li className="flex items-start"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> {ASSESSMENT_FACTS.objective.durationLabel} time limit</li>
                <li className="flex items-start font-semibold text-slate-900"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> Score {ASSESSMENT_FACTS.objective.passMark}% to unlock theory</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <FileText className="h-7 w-7 text-[#0B3A82]" />
              </div>
              <h4 className="mb-4 text-xl font-bold text-slate-900">Theory Exam</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> Answer {ASSESSMENT_FACTS.theory.answer} out of {ASSESSMENT_FACTS.theory.questions} questions</li>
                <li className="flex items-start"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> {ASSESSMENT_FACTS.theory.durationLabel} time limit</li>
                <li className="flex items-start"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> Graded by lecturer with feedback</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <GraduationCap className="h-7 w-7 text-[#0B3A82]" />
              </div>
              <h4 className="mb-4 text-xl font-bold text-slate-900">Continuous Work</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> Chapter knowledge checks</li>
                <li className="flex items-start"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> Practical exercises and PRECIS strings</li>
                <li className="flex items-start"><CheckCircle2 className="mr-2 h-4 w-4 text-[#0B3A82] shrink-0 mt-0.5" /> Revision centre preparation</li>
              </ul>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="bg-[#0B3A82] py-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs><pattern id="grid-bottom" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 40L40 0H20L0 20M40 40V20L20 40" fill="none" stroke="white" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid-bottom)" />
            </svg>
          </div>
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Ready to begin your study?</h2>
            <p className="mt-4 text-xl text-blue-100">
              Join the academic platform and start your journey in information organization today.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <ButtonLink href="/signup" variant="custom" size="lg" className="bg-white text-[#0B3A82] hover:bg-white/90 shadow-lg px-8 font-bold">
                Enrol Now
              </ButtonLink>
              <ButtonLink href="/login" variant="custom" size="lg" className="border border-white/30 text-white hover:bg-white/10 px-8">
                Sign in to access more features
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
