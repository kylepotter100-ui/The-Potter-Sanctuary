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
  bookingId: string;
  siteUrl: string;
};

export default function ReviewRequest({
  firstName,
  bookingId,
  siteUrl,
}: Props) {
  const reviewUrl = `${siteUrl}/review?booking=${encodeURIComponent(
    bookingId
  )}`;

  return (
    <EmailLayout siteUrl={siteUrl} preview="How was your session?">
      <ContentSection>
        <SectionHeading>How was your session?</SectionHeading>
        <Paragraph>
          Dear {firstName}, we hope you feel restored after your treatment
          today. Your feedback means a great deal to us — and helps us
          continue to refine the sanctuary experience.
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
