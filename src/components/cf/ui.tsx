import { Link } from "@tanstack/react-router";
import { AlertCircle, Plus, X } from "lucide-react";
import { cloneElement, isValidElement, useId, useState, type ButtonHTMLAttributes, type FocusEvent, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { setUserName, useUserName } from "@/lib/store";

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 text-primary-foreground no-underline">
      <span className="relative inline-block h-7 w-7 shrink-0 overflow-hidden rounded-full bg-accent sm:h-8 sm:w-8">
        <span className="absolute left-1/2 top-[-20%] h-[140%] w-1.5 -translate-x-1/2 rotate-45 bg-highlight" />
      </span>
      <span className="font-display text-xl sm:text-2xl">
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
      <div className="flex min-h-16 w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-8 sm:px-6 lg:px-10">
        <Logo />
        <nav className="order-3 flex w-full gap-4 text-sm sm:order-none sm:w-auto sm:gap-6 sm:text-[15px]">
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
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-sm font-bold text-success sm:h-10 sm:w-10"
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
    accent: "bg-accent text-accent-foreground hover:bg-accent-strong disabled:bg-accent/45 disabled:text-accent-foreground aria-disabled:cursor-not-allowed aria-disabled:bg-accent/45 aria-disabled:hover:bg-accent/45",
    outline: "border-2 border-border bg-card text-foreground hover:border-input",
    ghost: "text-accent hover:bg-secondary",
    danger: "text-destructive hover:bg-secondary",
  }[variant];
  return (
    <button
      type="button"
      {...p}
      className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none", variant === "accent" && "disabled:bg-accent/45 disabled:text-accent-foreground", v, className)}
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

const REQUIRED_TIP = {
  text: "Champ obligatoire : saisissez du contenu rédigé, avec des mots (pas uniquement des chiffres), pour pouvoir continuer.",
  choice: "Choix obligatoire : sélectionnez une option pour pouvoir continuer.",
};

/**
 * Astérisque rouge des champs obligatoires. Au survol, au focus clavier ou au toucher,
 * une infobulle précise ce qui est attendu ; « obligatoire » reste lu par les lecteurs d’écran.
 */
export function Required({ onDark, kind = "text" }: { onDark?: boolean | undefined; kind?: "text" | "choice" }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={REQUIRED_TIP[kind]}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
            className={cn("ml-1 cursor-help rounded-sm px-0.5 font-sans font-bold", onDark ? "text-highlight" : "text-destructive")}
          >
            *
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" collisionPadding={12} className={cn("max-w-64 rounded-xl px-3 py-2 text-sm font-normal leading-snug shadow-soft", onDark && "border border-border bg-card text-foreground")}>
          {REQUIRED_TIP[kind]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RequiredLegend({ onDark }: { onDark?: boolean | undefined }) {
  return <p className={cn("text-xs", onDark ? "text-primary-foreground/70" : "text-muted-foreground")}><span aria-hidden="true" className={cn("font-bold", onDark ? "text-highlight" : "text-destructive")}>*</span> Champ obligatoire</p>;
}

export const inputCls =
  "w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-base placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none";

/** Contour rouge d’un champ en erreur (vide ou mal formé). */
export const invalidCls = "cf-invalid border-destructive focus:border-destructive ring-4 ring-destructive/15";
/** Contour rouge d’un groupe de choix obligatoire resté sans réponse. */
export const choiceInvalidCls = "cf-invalid rounded-[1.75rem] outline-2 outline-offset-4 outline-destructive";

export function FieldError({ id, children, onDark }: { id?: string; children: ReactNode; onDark?: boolean | undefined }) {
  return (
    <span id={id} role="alert" className={cn("cf-error-msg flex items-start gap-1.5 text-sm font-bold", onDark ? "text-highlight" : "text-destructive")}>
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

type ControlProps = { value?: unknown; className?: string; onBlur?: (e: FocusEvent) => void; onChange?: (e: ChangeEvent) => void };

/**
 * Champ de formulaire. Pour un champ `required` :
 * - vide → contour rouge seulement quand l’utilisateur tente de passer à la suite (`show`) ;
 * - mal formé (`error`) → contour rouge + message sous le champ, dès que l’utilisateur quitte le champ.
 * Le contour disparaît dès que la saisie redevient valide.
 */
export function Field({ label, hint, required, group, children, error, empty, show, onDark, noMark }: {
  label: string; hint?: string; required?: boolean; group?: boolean; children: ReactNode;
  error?: string | null; empty?: boolean; show?: boolean; onDark?: boolean;
  /** Ne pas répéter l’astérisque quand l’obligation porte sur le groupe (« l’un ou l’autre »). */
  noMark?: boolean;
}) {
  const Tag = group ? "div" : "label";
  const errId = useId();
  const [touched, setTouched] = useState(false);
  const child = isValidElement(children) ? (children as ReactElement<ControlProps>) : null;
  const isEmpty = empty ?? String(child?.props.value ?? "").trim() === "";
  const showFormat = !!error && (show || touched);
  const invalid = !!required && ((isEmpty && show) || showFormat);
  const control = child && !group
    ? cloneElement(child, {
        "aria-invalid": invalid || undefined,
        "aria-required": required || undefined,
        "aria-describedby": showFormat ? errId : undefined,
        className: cn(child.props.className, invalid && invalidCls),
        onBlur: (e: FocusEvent) => { setTouched(true); child.props.onBlur?.(e); },
      } as Partial<ControlProps>)
    : children;
  return (
    <Tag className="block space-y-2" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="block font-bold">
        {label}
        {required && !noMark && <Required onDark={onDark} />}
      </span>
      {hint && <span className={cn("block text-sm", onDark ? "text-primary-foreground/70" : "text-muted-foreground")}>{hint}</span>}
      {control}
      {showFormat && <FieldError id={errId} onDark={onDark}>{error}</FieldError>}
    </Tag>
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
