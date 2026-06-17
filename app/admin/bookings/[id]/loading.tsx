import AdminSkeleton, { SkCard, SkLine } from "@/components/admin/AdminSkeleton";

// Mirrors the booking detail page: back link + name/lede + detail cards.
export default function Loading() {
  return (
    <AdminSkeleton
      active="bookings"
      back={{ href: "/admin/bookings", label: "← Back to bookings" }}
    >
      <h1>
        <SkLine w="55%" h={30} />
      </h1>
      <p className="lede">
        <SkLine w="70%" />
      </p>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkCard key={i}>
          <div className="sk-stack">
            <SkLine w="35%" h={20} />
            <SkLine w="80%" />
            <SkLine w="60%" />
          </div>
        </SkCard>
      ))}
    </AdminSkeleton>
  );
}
