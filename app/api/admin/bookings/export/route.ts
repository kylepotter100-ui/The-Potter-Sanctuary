import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_session")?.value === "authenticated";
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote and escape if the value contains comma, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = supabaseAdmin
    .from("bookings")
    .select(
      // `voucher:vouchers(code)` is a PostgREST FK embed via bookings.voucher_id
      // — one query, no N+1. Null for every cash booking.
      "id, booking_date, booking_time, customer_first_name, customer_last_name, customer_email, customer_phone, treatment_name, treatment_price, status, cancellation_reason, cancelled_by, created_at, voucher:vouchers(code)"
    )
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true });

  if (from && isoDateRe.test(from)) query = query.gte("booking_date", from);
  if (to && isoDateRe.test(to)) query = query.lte("booking_date", to);

  const { data: rows, error } = await query;
  if (error) {
    console.error("[export] query failed", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Which bookings have a consultation linked, for the "Consultation
  // Completed" column.
  const ids = (rows ?? []).map((b) => b.id);
  const consulted = new Set<string>();
  if (ids.length > 0) {
    const { data: consults } = await supabaseAdmin
      .from("consultation_responses")
      .select("booking_id")
      .in("booking_id", ids);
    for (const c of consults ?? []) {
      if (c.booking_id) consulted.add(c.booking_id as string);
    }
  }

  // PostgREST returns a to-one embed as an object, but can surface it as a
  // one-element array depending on how the relationship is inferred. Accept
  // both rather than silently printing "Cash" for a voucher booking.
  function voucherCodeOf(b: unknown): string | null {
    const v = (b as { voucher?: unknown }).voucher;
    if (!v) return null;
    const row = Array.isArray(v) ? v[0] : v;
    const code = (row as { code?: unknown } | undefined)?.code;
    return typeof code === "string" ? code : null;
  }

  const header = [
    "Booking ID",
    "Date",
    "Time",
    "Customer Name",
    "Email",
    "Phone",
    "Treatment",
    "Cost",
    "Paid With",
    "Status",
    "Cancellation Reason",
    "Cancelled By",
    "Created At",
    "Consultation Completed",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const b of rows ?? []) {
    lines.push(
      [
        b.id,
        b.booking_date,
        String(b.booking_time).slice(0, 5),
        `${b.customer_first_name} ${b.customer_last_name}`.trim(),
        b.customer_email,
        b.customer_phone,
        b.treatment_name,
        // Cost stays the LIST PRICE even for a voucher-funded booking, so the
        // meaning of this column is unchanged for anyone with older exports.
        // "Paid With" is the new key to filter/SUMIF on to get actual takings.
        `£${b.treatment_price}`,
        voucherCodeOf(b) ? `Voucher ${voucherCodeOf(b)}` : "Cash",
        b.status,
        b.cancellation_reason ?? "",
        b.cancelled_by ?? "",
        b.created_at,
        consulted.has(b.id) ? "Yes" : "No",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = lines.join("\r\n");
  const filename = `potter-sanctuary-bookings-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
