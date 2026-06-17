import AdminSkeleton, { SkLine } from "@/components/admin/AdminSkeleton";

// Mirrors the bookings list (header + lede + a list of booking cards).
function BkCardSkeleton() {
  return (
    <div className="bk-card sk-card">
      <div className="bk-card-top">
        <SkLine w="42%" />
        <SkLine w="64px" h={20} />
      </div>
      <div className="bk-name">
        <SkLine w="55%" />
      </div>
      <div className="bk-treat">
        <SkLine w="40%" />
      </div>
      <div className="bk-chips">
        <SkLine w="78px" h={22} />
        <SkLine w="78px" h={22} />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <AdminSkeleton active="bookings" title="Bookings" lede="Tap a booking to manage.">
      <div className="bk-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <BkCardSkeleton key={i} />
        ))}
      </div>
    </AdminSkeleton>
  );
}
