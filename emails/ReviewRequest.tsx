import {
  ContentSection,
  CtaButton,
  EmailLayout,
  INK_SOFT,
  Paragraph,
  SectionHeading,
  Divider,
} from "./_shared";

type Props = {
  firstName: string;
  treatmentName: string;
  visitDate: string;
  bookingId: string;
  siteUrl: string;
  /** Short after-care tips for this treatment (lib/services.ts). */
  aftercare?: string[];
  /** Link to rebook the same treatment (its page, booking widget preselected). */
  rebookUrl?: string | null;
};

export default function ReviewRequest({
  firstName,
  treatmentName,
  visitDate,
  bookingId,
  siteUrl,
  aftercare = [],
  rebookUrl = null,
}: Props) {
  const reviewUrl = `${siteUrl}/review?booking=${encodeURIComponent(
    bookingId
  )}`;

  return (
    <EmailLayout siteUrl={siteUrl} preview={`How was your ${treatmentName}?`}>
      <ContentSection>
        {aftercare.length > 0 && (
          <>
            <SectionHeading>Looking after yourself today</SectionHeading>
            <ul style={{ fontFamily: "Georgia, 'Times New Roman', serif", margin: "0 0 18px", paddingLeft: 20, color: INK_SOFT, fontSize: 15, lineHeight: 1.7 }}>
              {aftercare.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <Divider />
          </>
        )}
        <SectionHeading>How was your session?</SectionHeading>
        <Paragraph>
          Dear {firstName}, thank you for visiting The Potter Sanctuary on{" "}
          {visitDate} for your {treatmentName}. We hope you feel restored.
          We&apos;d love to hear how it went — your feedback means a great deal
          to us, and helps us continue to refine the sanctuary experience.
        </Paragraph>

        <CtaButton href={reviewUrl} label="Share your feedback" />

        <p
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 13,
            lineHeight: 1.6,
            color: INK_SOFT,
            margin: 0,
            textAlign: "center" as const,
          }}
        >
          It only takes a minute. Thank you.
        </p>
        {rebookUrl && (
          <>
            <Divider />
            <SectionHeading>When you&apos;re ready for the next one</SectionHeading>
            <Paragraph>
              Regular sessions help the benefits build. Your favourite times go
              quickly — book your next {treatmentName} whenever suits you.
            </Paragraph>
            <CtaButton href={rebookUrl} label={`Book another ${treatmentName}`} variant="outline" />
          </>
        )}
      </ContentSection>
    </EmailLayout>
  );
}
