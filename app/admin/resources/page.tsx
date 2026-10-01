import ResourceManager from "@/components/admin/resource-manager";

export const metadata = { title: "Resources" };
export const dynamic = "force-dynamic";

export default function ResourcesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl text-ink">Resources</h1>
        <p className="text-sm text-ink-muted">
          Add the files and links for this course, group them into categories and choose who can
          see them. Everything saved here appears straight away on the learner Resources page.
        </p>
      </header>
      <ResourceManager />
    </div>
  );
}
