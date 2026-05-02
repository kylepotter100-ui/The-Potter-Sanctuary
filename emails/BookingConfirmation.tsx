import { Section } from "@react-email/components";
import {
  ContentSection,
  CtaButton,
  DetailRow,
  Divider,
  EmailLayout,
  INK,
  INK_SOFT,
  MutedParagraph,
  Paragraph,
  SectionHeading,
  SERIF,
  BONE,
  LINE,
} from "./_shared";

type Props = {
  firstName: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  treatmentPrice: number;
  bookingId: string;
  siteUrl: string;
  includeConsultationCTA?: boolean;
};

export default function BookingConfirmation({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  treatmentPrice,
  bookingId,
  siteUrl,
  includeConsultationCTA = true,
}: Props) {
  const consultationUrl = `${siteUrl}/questionnaire?booking=${encodeURIComponent(
    bookingId
  )}`;

  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Your reservation at The Potter Sanctuary — ${bookingDate} at ${bookingTime}`}
    >
      <ContentSection>
        <SectionHeading>Dear {firstName},</SectionHeading>
        <Paragraph>
          Thank you for booking your time at The Potter Sanctuary. Your
          reservation is confirmed.
        </Paragraph>

        {/* Booking details */}
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
          <DetailRow label="Date" value={bookingDate} />
          <DetailRow label="Time" value={bookingTime} />
          <DetailRow label="Cost" value={`£${treatmentPrice}`} />
          <DetailRow
            label="Location"
            value="The Potter Sanctuary, Beck Row, Suffolk"
            last
          />
        </Section>

        {/* Payment */}
        <Divider />
        <SectionHeading>Payment</SectionHeading>
        <Paragraph>
          Payment is taken in cash directly after your treatment at the studio.
          We do not accept card or electronic payments at this time.
        </Paragraph>

        {/* Consultation CTA (or returning-customer note) */}
        {includeConsultationCTA ? (
          <>
            <Divider />
            <SectionHeading>Before your session</SectionHeading>
            <MutedParagraph>
              To help us tailor your treatment, please complete your brief
              consultation form. This takes just a few minutes.
            </MutedParagraph>
            <CtaButton
              href={consultationUrl}
              label="Complete Your Consultation Questionnaire"
            />
            <p
              style={{
                fontSize: 13,
                fontStyle: "italic",
                lineHeight: 1.6,
                color: INK_SOFT,
                textAlign: "center" as const,
                margin: "0",
              }}
            >
              Please complete this at least 12 hours before your appointment.
              Without it, there is a risk your treatment may not be able to
              commence.
            </p>
          </>
        ) : (
          <>
            <Divider />
            <Paragraph>
              Your consultation details from your previous visit are on file.
              We&apos;re looking forward to seeing you.
            </Paragraph>
          </>
        )}

        <Divider />
        <Paragraph>We look forward to caring for you.</Paragraph>
        <p
          style={{
            fontFamily: SERIF,
            fontSize: 17,
            color: INK,
            margin: 0,
            fontStyle: "italic",
          }}
        >
          The Potter Sanctuary
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
