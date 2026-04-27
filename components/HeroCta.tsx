"use client";

type Props = {
  target: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
};

export default function HeroCta({ target, children, variant = "primary" }: Props) {
  const className = variant === "primary" ? "btn-primary" : "btn-ghost";
  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!target.startsWith("#")) return;
    e.preventDefault();
    const el = document.querySelector(target);
    if (el && el instanceof HTMLElement) {
      window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
    }
  }
  return (
    <a href={target} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
