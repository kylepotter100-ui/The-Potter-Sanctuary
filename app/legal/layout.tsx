import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      {/* Note: we deliberately don't wrap in `.page` here — that class is
          opacity:0 until the homepage Intro component adds `.show`, which
          would leave these pages invisible. */}
      <main className="legal-page">
        <header className="legal-page-header">
          <p className="legal-eyebrow">The Potter Sanctuary</p>
        </header>
        <article className="legal-shell">{children}</article>
      </main>
      <Footer />
    </>
  );
}
