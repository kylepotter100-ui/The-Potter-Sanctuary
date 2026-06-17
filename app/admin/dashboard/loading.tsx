import AdminSkeleton, { SkCard, SkLine } from "@/components/admin/AdminSkeleton";

// Mirrors the dashboard: revenue hero, status strip, and the KPI tile grid.
export default function Loading() {
  return (
    <AdminSkeleton active="dashboard" title="Dashboard">
      <SkCard>
        <div className="sk-stack">
          <SkLine w="40%" />
          <SkLine w="55%" h={32} />
          <SkLine w="30%" />
        </div>
      </SkCard>
      <div className="status-strip">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="status-cell">
            <SkLine w="60%" />
            <SkLine w="40%" h={24} />
          </div>
        ))}
      </div>
      <div className="kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi-tile">
            <SkLine w="55%" />
            <SkLine w="45%" h={24} />
          </div>
        ))}
      </div>
    </AdminSkeleton>
  );
}
