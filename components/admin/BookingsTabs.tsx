"use client";

// Native-style segmented control at the top of the admin Bookings page.
// Left = Bookings (the existing server-rendered view, passed in as a prop and
// UNCHANGED), Right = Vouchers (the mock prototype panel). Tapping a segment
// swaps the content beneath. This does NOT add a bottom-nav tab — the bottom
// AdminTabBar stays on "Bookings" either way.

import { useState } from "react";
import VouchersPanel, { type VoucherListItem } from "./VouchersPanel";

type Seg = "bookings" | "vouchers";

export default function BookingsTabs({
  bookingsContent,
  vouchers,
}: {
  bookingsContent: React.ReactNode;
  vouchers: VoucherListItem[];
}) {
  const [active, setActive] = useState<Seg>("bookings");

  return (
    <>
      <div className="seg-control" role="tablist" aria-label="Bookings or Vouchers">
        <button
          type="button"
          role="tab"
          aria-selected={active === "bookings"}
          className={`seg-control-seg${active === "bookings" ? " is-active" : ""}`}
          onClick={() => setActive("bookings")}
        >
          Bookings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "vouchers"}
          className={`seg-control-seg${active === "vouchers" ? " is-active" : ""}`}
          onClick={() => setActive("vouchers")}
        >
          Vouchers
        </button>
      </div>

      {active === "bookings" ? bookingsContent : <VouchersPanel vouchers={vouchers} />}
    </>
  );
}
