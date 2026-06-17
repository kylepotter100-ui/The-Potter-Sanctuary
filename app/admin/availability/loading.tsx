import AdminSkeleton, { SkCard, SkLine } from "@/components/admin/AdminSkeleton";

// Mirrors the availability screen: week-nav card + day/slot cards.
export default function Loading() {
  return (
    <AdminSkeleton
      active="availability"
      title="Availability"
      lede="Manage opening days, time slots, and blackout dates."
    >
      <SkCard>
        <div className="sk-stack">
          <SkLine w="50%" h={20} />
          <SkLine w="30%" />
        </div>
      </SkCard>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkCard key={i}>
          <div className="sk-stack">
            <SkLine w="35%" />
            <SkLine w="80%" />
            <SkLine w="65%" />
          </div>
        </SkCard>
      ))}
    </AdminSkeleton>
  );
}
