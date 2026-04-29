"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  current: "pending" | "confirmed" | "cancelled";
};

export default function BookingActions({ bookingId, current }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);

  async function update(status: "confirmed" | "cancelled") {
    setBusy(status === "confirmed" ? "confirm" : "cancel");
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="btn-row">
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => update("confirmed")}
        disabled={current === "confirmed" || busy !== null}
      >
        {busy === "confirm" ? "…" : "Confirm"}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-danger"
        onClick={() => update("cancelled")}
        disabled={current === "cancelled" || busy !== null}
      >
        {busy === "cancel" ? "…" : "Cancel"}
      </button>
    </div>
  );
}
