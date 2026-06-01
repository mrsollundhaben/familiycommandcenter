import Link from "next/link";

type AdminBackLinkProps = {
  href?: string;
  label?: string;
};

export function AdminBackLink({ href = "/admin", label = "← Zurück" }: AdminBackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
    >
      {label}
    </Link>
  );
}
