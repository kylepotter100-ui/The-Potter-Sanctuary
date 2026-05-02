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
import type { ReactNode } from "react";

// Shared design tokens. Every transactional email uses these so the visual
// language stays consistent with the magic-link template.
export const SAGE = "#8A9E85";
export const SAGE_DEEP = "#6E8068";
export const CREAM = "#F5F0E8";
export const BONE = "#FBF7EC";
export const INK = "#1C1C1C";
export const INK_SOFT = "#4A4A4A";
export const LINE = "rgba(28,28,28,0.12)";

export const SERIF = "Georgia, 'Times New Roman', serif";
export const SANS = "Georgia, 'Times New Roman', serif";

export const STUDIO_NAME = "The Potter Sanctuary";
export const STUDIO_LOCATION = "The Potter Sanctuary, Beck Row, Suffolk";
export const SUPPORT_EMAIL = "hello@thepottersanctuary.co.uk";

type LayoutProps = {
  preview: string;
  siteUrl: string;
  children: ReactNode;
};

// Wraps every email in the canonical sage banner + content + footer chrome.
// Pages just supply the inner sections.
export function EmailLayout({ preview, siteUrl, children }: LayoutProps) {
  const logoUrl = `${siteUrl}/sanctuary-logo.png`;
  const privacyUrl = `${siteUrl}/legal/privacy`;
  const cancellationUrl = `${siteUrl}/legal/terms`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          background: CREAM,
          fontFamily: SERIF,
          color: INK,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: 0 }}>
          {/* Header */}
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
                      alt={STUDIO_NAME}
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
                        fontSize: 24,
                        margin: 0,
                        letterSpacing: "0.01em",
                        lineHeight: 1.2,
                      }}
                    >
                      {STUDIO_NAME}
                    </Heading>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Content (the page's own sections) */}
          {children}

          {/* Footer */}
          <Section
            style={{
              background: SAGE,
              padding: "20px 28px",
              textAlign: "center" as const,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: "#ffffff",
                margin: "0 0 6px",
                lineHeight: 1.6,
                opacity: 0.95,
              }}
            >
              {STUDIO_LOCATION}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#ffffff",
                margin: "0 0 8px",
                lineHeight: 1.6,
                opacity: 0.95,
              }}
            >
              Need help? Reply to this email or contact{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                style={{ color: "#ffffff", textDecoration: "underline" }}
              >
                {SUPPORT_EMAIL}
              </a>
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#ffffff",
                margin: 0,
                opacity: 0.85,
              }}
            >
              <a
                href={privacyUrl}
                style={{ color: "#ffffff", textDecoration: "underline" }}
              >
                Privacy Policy
              </a>
              {" · "}
              <a
                href={cancellationUrl}
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

// White content section with comfortable padding. Pass a child to render.
export function ContentSection({
  children,
  pad = "40px 32px",
}: {
  children: ReactNode;
  pad?: string;
}) {
  return (
    <Section style={{ background: "#ffffff", padding: pad }}>
      {children}
    </Section>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h2"
      style={{
        fontFamily: SERIF,
        fontWeight: 400,
        fontSize: 22,
        color: INK,
        margin: "0 0 14px",
        lineHeight: 1.25,
      }}
    >
      {children}
    </Heading>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 16,
        lineHeight: 1.6,
        color: INK,
        margin: "0 0 14px",
      }}
    >
      {children}
    </Text>
  );
}

export function MutedParagraph({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 15,
        lineHeight: 1.6,
        color: INK_SOFT,
        margin: "0 0 12px",
      }}
    >
      {children}
    </Text>
  );
}

// Sage CTA button. Pass href + label.
export function CtaButton({ href, label }: { href: string; label: string }) {
  return (
    <Section
      style={{ textAlign: "center" as const, margin: "32px 0" }}
    >
      <Button
        href={href}
        style={{
          background: SAGE,
          color: "#ffffff",
          fontFamily: SERIF,
          fontSize: 16,
          textDecoration: "none",
          padding: "16px 32px",
          borderRadius: 6,
          letterSpacing: "0.02em",
          display: "inline-block",
          fontWeight: 400,
        }}
      >
        {label}
      </Button>
    </Section>
  );
}

// Soft sage divider — used between content blocks like the payment notice.
export function Divider() {
  return (
    <div
      style={{
        borderTop: `1px solid ${SAGE}`,
        margin: "24px 0",
      }}
    />
  );
}

// Booking detail row — label / value pair, table layout for Outlook safety.
export function DetailRow({
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
