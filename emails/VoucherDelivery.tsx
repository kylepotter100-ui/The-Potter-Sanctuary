import { Img, Section } from "@react-email/components";
import {
  ContentSection,
  Divider,
  DetailRow,
  EmailLayout,
  MutedParagraph,
  Paragraph,
  SectionHeading,
  SERIF,
  SANS,
  CREAM,
  SAGE,
} from "./_shared";
import { isComplimentaryVoucher, voucherValueLabel } from "@/lib/vouchers";

type Props = {
  purchaserName: string;
  recipientName: string;
  treatmentName: string;
  value: number; // pounds
  code: string;
  giftMessage: string | null;
  expiresLabel: string;
  siteUrl: string;
};

export default function VoucherDelivery({
  purchaserName,
  recipientName,
  treatmentName,
  value,
  code,
  giftMessage,
  expiresLabel,
  siteUrl,
}: Props) {
  const firstName = purchaserName.split(" ")[0] || purchaserName;
  // Complimentary vouchers are stored with value 0 (see lib/vouchers.ts). They
  // read "Complimentary" rather than "£0", and drop the "thank you" framing —
  // nobody paid for this one.
  const complimentary = isComplimentaryVoucher(value);

  return (
    <EmailLayout
      siteUrl={siteUrl}
      preview={`Your gift voucher — ${treatmentName}`}
    >
      <ContentSection>
        <SectionHeading>Your gift voucher</SectionHeading>
        <Paragraph>Dear {firstName},</Paragraph>
        <Paragraph>
          {complimentary
            ? "With our compliments — this gift voucher is ready to use."
            : "Thank you — your gift voucher is ready."}{" "}
          It&apos;s shown below; forward or print this email and give it to{" "}
          {recipientName}.
        </Paragraph>

        {/* Email-safe e-card: a table (Outlook-friendly), solid sage bg, the real
            daffodil logo as a remote image, cream text. */}
        <Section style={{ margin: "8px 0 6px" }}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            width="100%"
            bgcolor={SAGE}
            style={{
              borderCollapse: "collapse",
              background: SAGE,
              borderRadius: 14,
            }}
          >
            <tbody>
              <tr>
                <td
                  width="110"
                  valign="middle"
                  style={{ padding: "24px 4px 24px 24px", verticalAlign: "middle" }}
                >
                  <Img
                    src={`${siteUrl}/sanctuary-logo.png`}
                    alt=""
                    width={82}
                    style={{ width: 82, height: "auto", display: "block" }}
                  />
                </td>
                <td
                  valign="middle"
                  style={{
                    padding: "22px 24px 22px 10px",
                    verticalAlign: "middle",
                    color: CREAM,
                  }}
                >
                  <div style={{ fontFamily: SERIF, fontSize: 15, opacity: 0.92, marginBottom: 6 }}>
                    The Potter Sanctuary
                  </div>
                  <div
                    style={{
                      fontFamily: SANS,
                      fontSize: 11,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase" as const,
                      opacity: 0.85,
                      marginBottom: 8,
                    }}
                  >
                    Gift Voucher
                  </div>
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontStyle: "italic" as const,
                      fontSize: 26,
                      lineHeight: 1.1,
                      marginBottom: 6,
                    }}
                  >
                    {treatmentName}
                  </div>
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontSize: complimentary ? 19 : 22,
                      marginBottom: 12,
                    }}
                  >
                    {voucherValueLabel(value)}
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      border: "1px solid rgba(245,240,232,0.55)",
                      borderRadius: 999,
                      padding: "6px 16px",
                      fontFamily: SANS,
                      fontSize: 13,
                      letterSpacing: "0.16em",
                    }}
                  >
                    {code}
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 11, opacity: 0.8, marginTop: 10 }}>
                    Valid until {expiresLabel}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Divider />
        <DetailRow label="For" value={recipientName} />
        {giftMessage ? <DetailRow label="Message" value={giftMessage} /> : null}
        <DetailRow label="Voucher code" value={code} />
        <DetailRow label="Valid until" value={expiresLabel} last />
        <Divider />

        <Paragraph>
          <strong>How to use it:</strong> give this voucher to {recipientName}.
          They can enter the code when booking online, or book as normal and
          bring the voucher along — we&apos;ll redeem it at the visit. Either
          way, there&apos;s nothing to pay on the day.
        </Paragraph>
        <MutedParagraph>Any questions? Just reply to this email.</MutedParagraph>
      </ContentSection>
    </EmailLayout>
  );
}
