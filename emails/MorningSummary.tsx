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
  consultation: "completed" | "pending" | "risk";
};

type Props = {
  todayLabel: string;
  confirmed: SummaryBooking[];
  pending: SummaryBooking[];
  alerts: SummaryBooking[];
  adminUrl: string;
  siteUrl: string;
};

function consultBadge(state: SummaryBooking["consultation"]): string {
  if (state === "completed") return "✓ Completed";
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
