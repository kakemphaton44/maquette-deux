import { Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { setUserName, useUserName } from "@/lib/store";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-primary-foreground no-underline">
      <span className="relative inline-block h-8 w-8 overflow-hidden rounded-full bg-accent">
        <span className="absolute left-1/2 top-[-20%] h-[140%] w-1.5 -translate-x-1/2 rotate-45 bg-highlight" />
      </span>
      <span className="font-display text-2xl">
        contre<span className="text-accent">–</span>feu
      </span>
    </Link>
  );
}

export function AppHeader() {
  const name = useUserName();
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="no-print sticky top-0 z-20 bg-primary text-primary-foreground">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
        <Logo />
        <nav className="flex gap-6 text-[15px]">
          <Link to="/" className="text-primary-foreground/80 no-underline hover:text-primary-foreground" activeProps={{ className: "!text-primary-foreground font-semibold" }} activeOptions={{ exact: true }}>
            Mes analyses
          </Link>
          <Link to="/nouvelle" className="text-primary-foreground/80 no-underline hover:text-primary-foreground" activeProps={{ className: "!text-primary-foreground font-semibold" }}>
            Nouvelle analyse
          </Link>
        </nav>
        <button
          type="button"
          onClick={() => {
            const n = window.prompt("Votre nom (sert seulement à signer vos synthèses)", name);
            if (n !== null) setUserName(n.trim());
          }}
          title={name || "Indiquer votre nom"}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-sm font-bold text-success"
        >
          {initials || "?"}
        </button>
      </div>
    </header>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-3xl border border-border bg-card p-7 shadow-soft", className)}>{children}</section>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "accent" | "ghost" | "outline" | "danger" };
export function Btn({ variant = "primary", className, ...p }: BtnProps) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    accent: "bg-accent text-accent-foreground hover:bg-accent-strong",
    outline: "border-2 border-border bg-card text-foreground hover:border-input",
    ghost: "text-accent hover:bg-secondary",
    danger: "text-destructive hover:bg-secondary",
  }[variant];
  return (
    <button
      type="button"
      {...p}
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50", v, className)}
    />
  );
}

export function Chip({ on, onClick, children, dashed }: { on: boolean; onClick: () => void; children: ReactNode; dashed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-5 text-[15px] transition-colors",
        on ? "bg-primary font-bold text-primary-foreground" : cn("border-2 bg-card font-medium hover:border-input", dashed ? "border-dashed border-input" : "border-border"),
      )}
    >
      {children}
    </button>
  );
}

export function Required() {
  return <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 align-middle font-sans text-[11px] font-bold text-secondary-foreground">Obligatoire</span>;
}

export const inputCls =
  "w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-base placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none";

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block font-bold">
        {label}
        {required && <Required />}
      </span>
      {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      {children}
    </label>
  );
}

export function ListEditor({ items, onChange, placeholder, addLabel = "Ajouter" }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; addLabel?: string }) {
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input className={inputCls} value={v} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          {items.length > 1 && (
            <button type="button" aria-label="Retirer" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-full px-3 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])} className="inline-flex items-center gap-1.5 text-sm font-bold text-accent">
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}

export function Pill({ tone = "muted", children }: { tone?: "muted" | "accent" | "success" | "primary" | "soft"; children: ReactNode }) {
  const t = {
    muted: "bg-muted text-foreground",
    accent: "bg-secondary text-secondary-foreground",
    success: "bg-success text-success-foreground",
    primary: "bg-primary text-highlight",
    soft: "bg-success-soft text-success",
  }[tone];
  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold", t)}>{children}</span>;
}
