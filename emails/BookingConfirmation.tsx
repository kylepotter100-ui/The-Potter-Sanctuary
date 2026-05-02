import {
  Body,
  Button,
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
  treatmentPrice: number;
  bookingId: string;
  siteUrl: string;
  includeConsultationCTA?: boolean;
};

const SAGE = "#8A9E85";
const CREAM = "#F5F0E8";
const BONE = "#FBF7EC";
const INK = "#1C1C1C";
const INK_SOFT = "#4A4A4A";
const LINE = "rgba(28,28,28,0.12)";

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "'Lora', Georgia, serif";

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
  const logoUrl = `${siteUrl}/sanctuary-logo.png`;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your reservation at The Potter Sanctuary — {bookingDate} at {bookingTime}
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
        <Container
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: 0,
          }}
        >
          {/* HEADER */}
          <Section
            style={{
              background: SAGE,
              padding: "24px 24px",
            }}
          >
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              align="center"
              style={{
                borderCollapse: "collapse",
                margin: "0 auto",
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      verticalAlign: "middle",
                      paddingRight: 14,
                    }}
                  >
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
                        lineHeight: 1.15,
                      }}
                    >
                      The Potter Sanctuary
                    </Heading>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* THANK YOU */}
          <Section
            style={{
              background: "#ffffff",
              padding: "32px 32px 8px",
            }}
          >
            <Text
              style={{
                fontFamily: SERIF,
                fontSize: 22,
                color: INK,
                margin: "0 0 14px",
                lineHeight: 1.3,
              }}
            >
              Dear {firstName},
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: INK_SOFT,
                margin: "0 0 8px",
              }}
            >
              Thank you for booking your time at The Potter Sanctuary. Your
              reservation is confirmed.
            </Text>
          </Section>

          {/* BOOKING DETAILS BOX */}
          <Section
            style={{
              background: "#ffffff",
              padding: "8px 32px 4px",
            }}
          >
            <Section
              style={{
                background: BONE,
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                padding: "20px 22px",
              }}
            >
              <DetailRow label="Treatment" value={treatmentName} />
              <DetailRow label="Date" value={bookingDate} />
              <DetailRow label="Time" value={bookingTime} />
              <DetailRow label="Investment" value={`£${treatmentPrice}`} />
              <DetailRow
                label="Location"
                value="The Potter Sanctuary, Beck Row, Suffolk"
                last
              />
            </Section>
          </Section>

          {/* CONSULTATION SECTION */}
          {includeConsultationCTA ? (
            <Section
              style={{
                background: "#ffffff",
                padding: "26px 32px 4px",
              }}
            >
              <Heading
                as="h2"
                style={{
                  fontFamily: SERIF,
                  fontWeight: 400,
                  fontSize: 22,
                  color: SAGE,
                  margin: "0 0 10px",
                  lineHeight: 1.25,
                }}
              >
                Before your session
              </Heading>
              <Text
                style={{
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: INK_SOFT,
                  margin: "0 0 20px",
                }}
              >
                To help us tailor your treatment, please complete your brief
                consultation form. This takes just a few minutes.
              </Text>
              <Section
                style={{ textAlign: "center" as const, margin: "0 0 12px" }}
              >
                <Button
                  href={consultationUrl}
                  style={{
                    background: SAGE,
                    color: "#ffffff",
                    fontFamily: SERIF,
                    fontSize: 17,
                    textDecoration: "none",
                    padding: "14px 28px",
                    borderRadius: 8,
                    letterSpacing: "0.02em",
                    display: "inline-block",
                  }}
                >
                  Complete Your Consultation Questionnaire
                </Button>
              </Section>
              <Text
                style={{
                  fontSize: 12,
                  fontStyle: "italic",
                  lineHeight: 1.6,
                  color: INK_SOFT,
                  textAlign: "center" as const,
                  margin: "0 0 4px",
                }}
              >
                Please complete this at least 12 hours before your appointment.
                Without it, there is a risk your treatment may not be able to
                commence.
              </Text>
            </Section>
          ) : (
            <Section
              style={{
                background: "#ffffff",
                padding: "26px 32px 4px",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: INK_SOFT,
                  margin: 0,
                }}
              >
                Your consultation details from your previous visit are on
                file. We&apos;re looking forward to seeing you.
              </Text>
            </Section>
          )}

          {/* CLOSING */}
          <Section
            style={{
              background: "#ffffff",
              padding: "28px 32px 36px",
            }}
          >
            <Text
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: INK_SOFT,
                margin: "0 0 8px",
              }}
            >
              We look forward to caring for you.
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                fontSize: 17,
                color: INK,
                margin: 0,
                fontStyle: "italic",
              }}
            >
              The Potter Sanctuary
            </Text>
          </Section>

          {/* FOOTER */}
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
                margin: "0 0 8px",
                opacity: 0.85,
                letterSpacing: "0.02em",
              }}
            >
              The Potter Sanctuary, Beck Row, Suffolk
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: "#ffffff",
                margin: 0,
                opacity: 0.85,
                lineHeight: 1.6,
              }}
            >
              <a
                href={`${siteUrl}/legal/privacy`}
                style={{ color: "#ffffff", textDecoration: "underline" }}
              >
                Privacy Policy
              </a>
              {" · "}
              <a
                href={`${siteUrl}/legal/terms`}
                style={{ color: "#ffffff", textDecoration: "underline" }}
              >
                Cancellation Policy
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginBottom: last ? 0 : 8,
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: INK_SOFT,
              fontFamily: SANS,
              padding: "4px 12px 4px 0",
              width: 130,
              verticalAlign: "top",
            }}
          >
            {label}
          </td>
          <td
            style={{
              fontFamily: SERIF,
              fontSize: 17,
              color: INK,
              padding: "4px 0",
              verticalAlign: "top",
            }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
