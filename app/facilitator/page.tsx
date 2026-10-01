import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Mail, Award, Building2, BookMarked } from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Course Facilitator",
  description:
    "Dr. Uzoamaka Ogwo (Ph.D), CLN — University Librarian at ESUT and course facilitator for Indexing and Abstracting.",
};

const researchInterests = [
  "ICT in libraries",
  "Artificial Intelligence (AI)",
  "Cloud computing",
  "Social networking",
  "Digital preservation",
  "Digital reference services",
  "Emerging technologies in libraries",
];

export default function FacilitatorPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Course Facilitator
          </p>
          <h1 className="font-display text-3xl text-ink">Uzoamaka Ogwo (Ph.D)</h1>
          <p className="text-lg text-ink-muted">University Librarian, ESUT</p>
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Building2 className="size-4 shrink-0" aria-hidden />
            Enugu State University of Science and Technology (ESUT), Agbani, Enugu State, Nigeria
          </p>
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <GraduationCap className="size-4 shrink-0" aria-hidden />
            Department of Library and Information Science, University of Nigeria, Nsukka
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <a
              href="mailto:Uzoamaka.ogwo@unn.edu.ng"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Mail className="size-4" aria-hidden /> Uzoamaka.ogwo@unn.edu.ng
            </a>
            <a
              href="https://orcid.org/0000-0002-6477-1248"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <BookMarked className="size-4" aria-hidden /> ORCID iD 0000-0002-6477-1248
            </a>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-ink-muted">
              Dr. Ogwo, Uzoamaka is a lecturer, researcher, and certified librarian (CLN) with
              many years of experience in library administration, digital librarianship,
              scholarly communication and emerging technologies in library and Information
              Science. She currently serves as the University Librarian at Enugu State
              University of Science and Technology (ESUT), Agbani, Enugu State, Nigeria. She is
              an active member of many professional associations including Nigerian Library
              Association (NLA). She has authored many books and published many scholarly works
              in reputable national and international journals.
            </p>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Award className="size-3.5" aria-hidden /> Certified Librarian (CLN)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Award className="size-3.5" aria-hidden /> Nigerian Library Association (NLA)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Research interests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {researchInterests.map((interest) => (
                <li
                  key={interest}
                  className="flex items-center gap-2 rounded-md bg-canvas px-3 py-2 text-sm text-ink"
                >
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  {interest}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-ink-muted">
          Questions about the course?{" "}
          <Link href="/help" className="font-medium text-primary hover:underline">
            Visit the help page
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
