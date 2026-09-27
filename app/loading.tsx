import { Skeleton, SkeletonCard } from "@/components/ui";

export default function Loading() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading, please wait</span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <div className="mt-8 flex flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  );
}
