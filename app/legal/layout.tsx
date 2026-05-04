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
      <main className="legal-page">
        <article className="legal-shell">{children}</article>
      </main>
      <Footer />
    </>
  );
}
