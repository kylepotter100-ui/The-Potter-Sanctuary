import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Nav />
      <div className="page show">
        <section className="hero" style={{ minHeight: "70vh" }}>
          <div className="hero-text">
            <div className="hero-eyebrow">Lost in the garden</div>
            <h1>
              This page <em>doesn't exist.</em>
            </h1>
            <p className="lede">
              Try the homepage, or pick a treatment from the menu.
            </p>
            <div className="hero-actions">
              <Link href="/" className="btn-primary">
                Return home
              </Link>
              <Link href="/#services" className="btn-ghost">
                Treatment menu
              </Link>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    </>
  );
}
