import { Section } from "@react-email/components";
import {
  ContentSection,
  Divider,
  EmailLayout,
  INK,
  INK_SOFT,
  Paragraph,
  SectionHeading,
  LINE,
} from "./_shared";

type Props = {
  firstName: string;
  lastName: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  customerEmail: string;
  customerPhone: string;
  reason?: string | null;
  siteUrl: string;
};

export default function OwnerCancellationByCustomer({
  firstName,
  lastName,
  treatmentName,
  bookingDate,
  bookingTime,
  customerEmail,
  customerPhone,
  reason,
  siteUrl,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Booking cancelled by customer — ${firstName} ${lastName}, ${bookingDate}`}
    >
      <ContentSection>
        <SectionHeading>Booking cancelled by customer</SectionHeading>
        <Paragraph>
          {firstName} {lastName} has cancelled their{" "}
          <strong>{treatmentName}</strong> booking on{" "}
          <strong>{bookingDate}</strong> at <strong>{bookingTime}</strong>.
        </Paragraph>

        {reason && reason.trim().length > 0 ? (
          <>
            <Divider />
            <SectionHeading>Reason</SectionHeading>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: INK,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {reason}
            </p>
          </>
        ) : null}

        <Divider />
        <Section
          style={{
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: "14px 16px",
          }}
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
