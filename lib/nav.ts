import type { NavLink } from "@/components/shell/nav-links";

export const LEARNER_NAV: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", exact: true },
  { href: "/dashboard/course", label: "Course" },
  { href: "/dashboard/assessments", label: "Assessments" },
  { href: "/dashboard", label: "Study tools", menu: "study-tools" },
  { href: "/profile", label: "Profile" },
  { href: "/help", label: "Help" },
];
