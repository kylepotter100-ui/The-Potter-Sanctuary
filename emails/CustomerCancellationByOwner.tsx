import { Section } from "@react-email/components";
import {
  ContentSection,
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
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  reason?: string | null;
  siteUrl: string;
};

export default function CustomerCancellationByOwner({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  reason,
  siteUrl,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview="Your booking at The Potter Sanctuary has been cancelled."
    >
      <ContentSection>
        <SectionHeading>Your booking has been cancelled</SectionHeading>
        <Paragraph>
          Dear {firstName}, we&apos;re sorry to inform you that your booking
          for <strong>{treatmentName}</strong> on{" "}
          <strong>{bookingDate}</strong> at <strong>{bookingTime}</strong> has
          been cancelled.
        </Paragraph>

        {reason && reason.trim().length > 0 ? (
          <Section
            style={{
              background: BONE,
              border: `1px solid ${LINE}`,
              borderRadius: 8,
              padding: "14px 16px",
              margin: "8px 0 16px",
            }}
          >
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: INK_SOFT,
                margin: "0 0 6px",
              }}
            >
              Reason
            </p>
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
          </Section>
        ) : null}

        <Divider />
        <Paragraph>
          Please don&apos;t hesitate to book another appointment when it suits
          you.
        </Paragraph>
      </ContentSection>
    </EmailLayout>
  );
}
