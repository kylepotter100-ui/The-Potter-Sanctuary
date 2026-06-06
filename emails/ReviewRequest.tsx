import {
  ContentSection,
  CtaButton,
  EmailLayout,
  INK_SOFT,
  Paragraph,
  SectionHeading,
} from "./_shared";

type Props = {
  firstName: string;
  treatmentName: string;
  bookingId: string;
  siteUrl: string;
};

export default function ReviewRequest({
  firstName,
  treatmentName,
  bookingId,
  siteUrl,
}: Props) {
  const reviewUrl = `${siteUrl}/review?booking=${encodeURIComponent(
    bookingId
  )}`;

  return (
    <EmailLayout siteUrl={siteUrl} preview={`How was your ${treatmentName}?`}>
      <ContentSection>
        <SectionHeading>How was your session?</SectionHeading>
        <Paragraph>
          Dear {firstName}, thank you for visiting The Potter Sanctuary for your{" "}
          {treatmentName}. We hope you feel restored. We&apos;d love to hear how
          it went — your feedback means a great deal to us, and helps us continue
          to refine the sanctuary experience.
        </Paragraph>

        <CtaButton href={reviewUrl} label="Share your feedback" />

        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: INK_SOFT,
            margin: 0,
            textAlign: "center" as const,
          }}
        >
          It only takes a minute. Thank you.
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
