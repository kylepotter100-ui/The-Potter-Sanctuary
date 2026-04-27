"use client";

type Props = {
  bookingId: string;
  label?: string;
};

export default function ServiceCardLink({ bookingId, label = "Reserve →" }: Props) {
  function onClick() {
    const el = document.querySelector("#booking");
    if (el && el instanceof HTMLElement) {
      window.scrollTo({ top: el.offsetTop - 30, behavior: "smooth" });
    }
    window.dispatchEvent(
      new CustomEvent<string>("tps:preselect", { detail: bookingId })
    );
  }
  return (
    <button type="button" className="svc-book" onClick={onClick}>
      {label}
    </button>
  );
}
