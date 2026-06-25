import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// Account area chrome: the public site header (so customers can navigate back to
// the homepage sections, sign out, etc.) + the footer. The account pages
// themselves render `<main className="account-page">`, which clears the fixed
// nav via its top padding (app/globals.css).
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav solid />
      {children}
      <Footer />
    </>
  );
}
