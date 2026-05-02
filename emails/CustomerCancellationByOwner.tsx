import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Props = {
  firstName: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  reason?: string | null;
  siteUrl: string;
};

const SAGE = "#8A9E85";
const CREAM = "#F5F0E8";
const INK = "#1C1C1C";
const INK_SOFT = "#4A4A4A";
const LINE = "rgba(28,28,28,0.12)";

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Lora', Georgia, serif";

export default function CustomerCancellationByOwner({
  firstName,
  treatmentName,
  bookingDate,
  bookingTime,
  reason,
  siteUrl,
}: Props) {
  const logoUrl = `${siteUrl}/sanctuary-logo.png`;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your booking at The Potter Sanctuary has been cancelled.
      </Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          background: CREAM,
          fontFamily: SANS,
          color: INK,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: 0 }}>
          <Section style={{ background: SAGE, padding: "24px 24px" }}>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              align="center"
              style={{ borderCollapse: "collapse", margin: "0 auto" }}
            >
              <tbody>
                <tr>
                  <td style={{ verticalAlign: "middle", paddingRight: 14 }}>
                    <Img
                      src={logoUrl}
                      alt="The Potter Sanctuary"
                      height={60}
                      style={{
                        height: 60,
                        width: "auto",
                        display: "block",
                        border: 0,
                      }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <Heading
                      as="h1"
                      style={{
                        fontFamily: SERIF,
                        fontWeight: 400,
                        color: "#ffffff",
                        fontSize: 28,
                        margin: 0,
                        letterSpacing: "0.02em",
                      }}
                    >
                      The Potter Sanctuary
                    </Heading>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ background: "#ffffff", padding: "32px 32px 8px" }}>
            <Heading
              as="h2"
              style={{
                fontFamily: SERIF,
                fontWeight: 400,
                fontSize: 26,
                color: INK,
                margin: "0 0 12px",
              }}
            >
              Your booking has been cancelled
            </Heading>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: INK_SOFT,
                margin: "0 0 12px",
              }}
            >
              Dear {firstName}, we&apos;re sorry to inform you that your
              booking for <strong>{treatmentName}</strong> on{" "}
              <strong>{bookingDate}</strong> at <strong>{bookingTime}</strong>{" "}
              has been cancelled.
            </Text>

            {reason && reason.trim().length > 0 ? (
              <Section
                style={{
                  background: "#FBF7EC",
                  border: `1px solid ${LINE}`,
                  borderRadius: 8,
                  padding: "14px 16px",
                  margin: "0 0 16px",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: INK_SOFT,
                    margin: "0 0 6px",
                  }}
                >
                  Reason
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: INK,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {reason}
                </Text>
              </Section>
            ) : null}

            <Text
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: INK_SOFT,
                margin: 0,
              }}
            >
              Please don&apos;t hesitate to book another appointment when it
              suits you.
            </Text>
          </Section>

          <Section
            style={{
              background: SAGE,
              padding: "20px 28px",
              textAlign: "center" as const,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: "#ffffff",
                margin: "0 0 6px",
                lineHeight: 1.6,
                opacity: 0.95,
              }}
            >
              To get in touch, simply reply to this email or contact us at
              hello@thepottersanctuary.co.uk
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#ffffff",
                margin: 0,
                opacity: 0.85,
              }}
            >
              The Potter Sanctuary, Beck Row, Suffolk
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
