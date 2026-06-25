import { Section } from "@react-email/components";
import {
  ContentSection,
  DetailRow,
  Divider,
  EmailLayout,
  INK,
  INK_SOFT,
  Paragraph,
  SectionHeading,
  BONE,
  LINE,
} from "./_shared";

type Props = {
  firstName: string;
  lastName: string;
  treatmentName: string;
  bookingDate: string; // new
  bookingTime: string; // new
  previousDate: string;
  previousTime: string;
  customerEmail: string;
  customerPhone: string;
  by: "customer" | "owner";
  siteUrl: string;
};

export default function OwnerRescheduleNotice({
  firstName,
  lastName,
  treatmentName,
  bookingDate,
  bookingTime,
  previousDate,
  previousTime,
  customerEmail,
  customerPhone,
  by,
  siteUrl,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Booking rescheduled — ${firstName} ${lastName}, now ${bookingDate}`}
    >
      <ContentSection>
        <SectionHeading>
          Booking rescheduled{by === "customer" ? " by customer" : ""}
        </SectionHeading>
        <Paragraph>
          {firstName} {lastName}&apos;s <strong>{treatmentName}</strong> booking
          has been moved.
        </Paragraph>

        <Section
          style={{
            background: BONE,
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            padding: "20px 22px",
            margin: "8px 0 4px",
          }}
        >
          <DetailRow label="Treatment" value={treatmentName} />
          <DetailRow label="New" value={`${bookingDate} at ${bookingTime}`} />
          <DetailRow
            label="Previously"
            value={`${previousDate} at ${previousTime}`}
            last
          />
        </Section>

        <Divider />
        <Section
          style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "14px 16px" }}
        >
          <p style={{ fontSize: 14, color: INK_SOFT, margin: "0 0 4px" }}>
            <strong style={{ color: INK }}>Email:</strong> {customerEmail}
          </p>
          <p style={{ fontSize: 14, color: INK_SOFT, margin: 0 }}>
            <strong style={{ color: INK }}>Phone:</strong> {customerPhone}
          </p>
        </Section>
      </ContentSection>
    </EmailLayout>
  );
}
