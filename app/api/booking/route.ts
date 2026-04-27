import { NextResponse } from "next/server";

type Payload = {
  date: string;
  dateLabel: string;
  time: string;
  service: { svc: string; name: string; price: number; duration: string };
  gender: string | null;
  fname: string;
  lname: string;
  phone: string;
  email: string;
  message?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(p: Payload) {
  const rows: Array<[string, string]> = [
    ["When", `${p.dateLabel} · ${p.time}`],
    ["Treatment", p.service.name],
    ["Duration", p.service.duration],
    ["Price", `£${p.service.price}`],
    ["Guest", `${p.fname} ${p.lname}`],
    ["Gender", p.gender ?? "—"],
    ["Phone", p.phone],
    ["Email", p.email],
  ];
  if (p.message && p.message.trim()) rows.push(["Message", p.message]);
  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 14px 8px 0;color:#5A6149;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-family:Lora,serif;">${escapeHtml(
          k
        )}</td><td style="padding:8px 0;font-family:'Cormorant Garamond',serif;font-size:16px;color:#3A3F31;">${escapeHtml(
          v
        )}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><body style="background:#EFE8D6;padding:24px;font-family:Lora,serif;color:#3A3F31;"><div style="max-width:560px;margin:0 auto;background:#FBF7EC;padding:32px;border-radius:8px;border:1px solid rgba(58,63,49,0.1);"><h1 style="font-family:'Cormorant Garamond',serif;font-weight:300;font-size:28px;margin:0 0 18px;">New booking enquiry</h1><table style="width:100%;border-collapse:collapse;">${rowsHtml}</table></div></body></html>`;
}

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required = [
    payload?.date,
    payload?.time,
    payload?.service?.name,
    payload?.fname,
    payload?.lname,
    payload?.phone,
    payload?.email,
  ];
  if (required.some((v) => !v) || !/\S+@\S+\.\S+/.test(payload.email)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BOOKING_EMAIL_TO;
  const from = process.env.BOOKING_EMAIL_FROM;

  if (!apiKey || !to || !from) {
    console.error("[booking] missing email env vars", {
      hasKey: !!apiKey,
      hasTo: !!to,
      hasFrom: !!from,
    });
    return NextResponse.json(
      { error: "Email is not configured on the server" },
      { status: 500 }
    );
  }

  const subject = `Booking — ${payload.service.name} · ${payload.dateLabel} · ${payload.time}`;
  const html = renderHtml(payload);

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: payload.email,
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[booking] resend error", resp.status, text);
    return NextResponse.json(
      { error: "Could not send booking email" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
