import type { ReactNode } from "react";

export function Card({
  title,
  step,
  children,
  aside,
  testId,
}: {
  title: string;
  step: string;
  children: ReactNode;
  aside?: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {step}
          </span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

const TONES = {
  neutral: "border-slate-300 bg-slate-100 text-slate-700",
  info: "border-indigo-200 bg-indigo-50 text-indigo-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone, children, testId }: { tone: Tone; children: ReactNode; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const style =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-600"
      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400";
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed ${style} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
