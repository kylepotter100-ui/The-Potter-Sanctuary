"use client";

import { useRouter } from "next/navigation";

type Props = {
  bookingId: string;
  status: "pending" | "confirmed" | "cancelled";
  children: React.ReactNode;
};

// Wraps a booking <tr> with a click-anywhere handler that navigates to the
// detail page. We use a normal <tr> + onClick (rather than wrapping in <a>
// or <Link>) because <tr>/<td> can't legally contain block-level anchors.
// The "Manage →" cell still has a real <Link> for keyboard / screen-reader
// users; this component just makes the rest of the row a friendly target
// for mouse clicks.
export default function AdminBookingRow({
  bookingId,
  status,
  children,
}: Props) {
  const router = useRouter();
  const href = `/admin/bookings/${bookingId}`;

  function onClick(e: React.MouseEvent<HTMLTableRowElement>) {
    // Don't hijack clicks that landed on an interactive element inside the
    // row — let the native handler run (e.g. the explicit Manage link).
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, label, select")) return;
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  }

  return (
    <tr
      className={`row-${status} row-link`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`Open booking ${bookingId}`}
    >
      {children}
    </tr>
  );
}
