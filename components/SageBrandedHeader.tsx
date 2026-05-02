import Image from "next/image";
import Link from "next/link";

// Reusable sage banner used on signed-in customer surfaces
// (questionnaire, account-style flows). Mirrors the email header.
export default function SageBrandedHeader() {
  return (
    <header className="sage-branded-header">
      <Link href="/" aria-label="The Potter Sanctuary, home">
        <Image
          src="/sanctuary-logo.png"
          alt=""
          width={272}
          height={382}
          priority
        />
        <span>The Potter Sanctuary</span>
      </Link>
    </header>
  );
}
