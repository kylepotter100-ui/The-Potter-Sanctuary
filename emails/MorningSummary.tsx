import { Section } from "@react-email/components";
import {
  ContentSection,
  EmailLayout,
  INK,
  INK_SOFT,
  Paragraph,
  SectionHeading,
  BONE,
  LINE,
  SAGE,
} from "./_shared";

export type SummaryBooking = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  treatment_name: string;
  booking_time: string;
  status: "pending" | "confirmed";
  consultation: "completed" | "pending" | "risk" | "onfile";
  /** Owner's private client notes, if any. */
  notes?: string | null;
};

/** A client who gets no automatic emails — the owner rings them instead. */
export type CallItem = {
  id: string;
  name: string;
  phone: string;
  when: string; // e.g. "Tomorrow 10:30"
  treatment_name: string;
  reason: string;
  notes?: string | null;
};

type Props = {
  todayLabel: string;
  confirmed: SummaryBooking[];
  pending: SummaryBooking[];
  alerts: SummaryBooking[];
  /** Clients to phone today (no emailed reminder). Optional for back-compat. */
  callList?: CallItem[];
  adminUrl: string;
  siteUrl: string;
};

function consultBadge(state: SummaryBooking["consultation"]): string {
  if (state === "completed") return "✓ Completed";
  if (state === "onfile") return "● On file (previous visit)";
  if (state === "risk") return "⚠️ Risk — within 12 hours";
  return "⏳ Pending";
}

function row(b: SummaryBooking) {
  return (
    <tr key={b.id}>
      <td
        style={{
          padding: "8px 12px 8px 0",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 16,
          color: INK,
          verticalAlign: "top",
          width: 90,
        }}
      >
        {b.booking_time}
      </td>
      <td
        style={{
          padding: "8px 12px 8px 0",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 16,
          color: INK,
          verticalAlign: "top",
        }}
      >
        {b.customer_first_name} {b.customer_last_name}
        <br />
        <span style={{ fontSize: 13, color: INK_SOFT }}>
          {b.treatment_name}
        </span>
        {b.notes ? (
          <>
            <br />
            <span style={{ fontSize: 13, color: INK_SOFT, fontStyle: "italic" }}>
              Note: {b.notes}
            </span>
          </>
        ) : null}
      </td>
      <td
        style={{
          padding: "8px 0",
          fontSize: 12,
          letterSpacing: "0.04em",
          color: INK_SOFT,
          verticalAlign: "top",
          textAlign: "right" as const,
        }}
      >
        {consultBadge(b.consultation)}
      </td>
    </tr>
  );
}

function BookingsTable({ rows }: { rows: SummaryBooking[] }) {
  if (rows.length === 0) return null;
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        borderCollapse: "collapse",
        margin: "8px 0 16px",
      }}
    >
      <tbody>{rows.map((b) => row(b))}</tbody>
    </table>
  );
}

export default function MorningSummary({
  todayLabel,
  confirmed,
  pending,
  alerts,
  callList = [],
  adminUrl,
  siteUrl,
}: Props) {
  const total = confirmed.length + pending.length;
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Today's bookings — ${todayLabel}`}
    >
      <ContentSection>
        <SectionHeading>Today&apos;s bookings — {todayLabel}</SectionHeading>

        {total === 0 ? (
          <Paragraph>
            You have no bookings today. Enjoy a peaceful day.
          </Paragraph>
        ) : (
          <>
            <Section
              style={{
                background: BONE,
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                padding: "16px 20px",
                margin: "8px 0 18px",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: INK_SOFT,
                  margin: "0 0 8px",
                }}
              >
                Confirmed bookings ({confirmed.length})
              </p>
              {confirmed.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: INK_SOFT }}>
                  None confirmed yet.
                </p>
              ) : (
                <BookingsTable rows={confirmed} />
              )}
            </Section>

            <Section
              style={{
                background: BONE,
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                padding: "16px 20px",
                margin: "0 0 18px",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: INK_SOFT,
                  margin: "0 0 8px",
                }}
              >
                Pending bookings ({pending.length})
              </p>
              {pending.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: INK_SOFT }}>
                  Nothing pending — everything confirmed.
                </p>
              ) : (
                <>
                  <BookingsTable rows={pending} />
                  <p
                    style={{
                      fontSize: 13,
                      fontStyle: "italic",
                      color: INK_SOFT,
                      margin: 0,
                    }}
                  >
                    These need confirmation from you.
                  </p>
                </>
              )}
            </Section>
          </>
        )}

        {alerts.length > 0 && (
          <Section
            style={{
              border: `1px solid ${SAGE}`,
              borderRadius: 10,
              padding: "16px 20px",
              margin: "0 0 18px",
            }}
          >
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: SAGE,
                margin: "0 0 8px",
              }}
            >
              Questionnaire alerts ({alerts.length})
            </p>
            <BookingsTable rows={alerts} />
            <p
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: INK_SOFT,
                margin: 0,
              }}
            >
              Bookings within 12 hours where the consultation hasn&apos;t been
              completed.
            </p>
          </Section>
        )}

        {callList.length > 0 && (
          <Section
            style={{
              border: `1px solid ${SAGE}`,
              borderRadius: 10,
              padding: "16px 20px",
              margin: "0 0 18px",
            }}
          >
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: SAGE,
                margin: "0 0 8px",
              }}
            >
              Phone today ({callList.length})
            </p>
            <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {callList.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "8px 12px 8px 0", fontSize: 16, color: INK, verticalAlign: "top" }}>
                      {c.name}
                      <br />
                      <span style={{ fontSize: 13, color: INK_SOFT }}>
                        {c.when} · {c.treatment_name}
                      </span>
                      {c.notes ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13, color: INK_SOFT, fontStyle: "italic" }}>Note: {c.notes}</span>
                        </>
                      ) : null}
                    </td>
                    <td style={{ padding: "8px 0", fontSize: 16, color: INK, verticalAlign: "top", textAlign: "right" as const, whiteSpace: "nowrap" as const }}>
                      <a href={`tel:${c.phone.replace(/\s/g, "")}`} style={{ color: SAGE }}>
                        {c.phone}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 13, fontStyle: "italic", color: INK_SOFT, margin: 0 }}>
              These clients don&apos;t get email reminders — a quick call to
              confirm tomorrow&apos;s appointment.
            </p>
          </Section>
        )}

        <p style={{ fontSize: 14, color: INK_SOFT, margin: 0 }}>
          Manage all bookings in your admin panel:{" "}
          <a href={adminUrl} style={{ color: SAGE }}>
            {adminUrl}
          </a>
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
