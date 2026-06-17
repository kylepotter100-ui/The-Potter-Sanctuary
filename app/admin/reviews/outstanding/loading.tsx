import AdminSkeleton, { SkCard, SkLine } from "@/components/admin/AdminSkeleton";

// Mirrors the outstanding-reviews list (back link + title + client cards).
export default function Loading() {
  return (
    <AdminSkeleton
      active="bookings"
      back={{ href: "/admin/bookings", label: "← Back to bookings" }}
      title="Outstanding reviews"
      lede="Completed sessions not yet reviewed."
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <SkCard key={i}>
          <div className="sk-stack">
            <SkLine w="50%" />
            <SkLine w="65%" />
          </div>
        </SkCard>
      ))}
    </AdminSkeleton>
  );
}
