import AdminSkeleton, { SkCard, SkLine } from "@/components/admin/AdminSkeleton";

// Mirrors the submitted-reviews list. Back link defaults to the dashboard (the
// real page picks dashboard/outstanding from ?from=, but the skeleton is shown
// before that resolves — dashboard is the safe, most-common default).
export default function Loading() {
  return (
    <AdminSkeleton
      active="dashboard"
      back={{ href: "/admin/dashboard", label: "← Back to dashboard" }}
      title="Reviews"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <SkCard key={i}>
          <div className="sk-stack">
            <SkLine w="45%" />
            <SkLine w="90%" />
            <SkLine w="70%" />
          </div>
        </SkCard>
      ))}
    </AdminSkeleton>
  );
}
