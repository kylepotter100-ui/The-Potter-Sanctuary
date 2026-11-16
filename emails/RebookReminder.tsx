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
  rebookUrl: string;
  unsubscribeUrl: string;
  siteUrl: string;
};

// Marketing email: only for clients who opted in. Always carries an unsubscribe
// link (plus List-Unsubscribe headers set by the sender).
export default function RebookReminder({ firstName, treatmentName, rebookUrl, unsubscribeUrl, siteUrl }: Props) {
  return (
    <EmailLayout siteUrl={siteUrl} preview={`Time for your next ${treatmentName}?`}>
      <ContentSection>
        <SectionHeading>Time for a little stillness again?</SectionHeading>
        <Paragraph>
          Dear {firstName}, it&apos;s been about five weeks since your{" "}
          {treatmentName}. Regular sessions help the benefits build — if
          you&apos;d like to come back, your favourite times are waiting.
        </Paragraph>
        <CtaButton href={rebookUrl} label={`Book your next ${treatmentName}`} />
        <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 12, lineHeight: 1.6, color: INK_SOFT, margin: "18px 0 0", textAlign: "center" as const }}>
          You&apos;re receiving this because you asked for reminders when you booked.{" "}
          <a href={unsubscribeUrl} style={{ color: INK_SOFT }}>Unsubscribe</a>
        </p>
      </ContentSection>
    </EmailLayout>
  );
}
