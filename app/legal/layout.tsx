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
      <div className="page">
        <main className="legal-page">
          <header className="legal-page-header">
            <p className="legal-eyebrow">The Potter Sanctuary</p>
          </header>
          <article className="legal-shell">{children}</article>
        </main>
        <Footer />
      </div>
    </>
  );
}
