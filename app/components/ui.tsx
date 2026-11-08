import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentPropsWithRef, HTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
export { default as SearchInput } from "./SearchField";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "text" }) {
  return <button type="button" className={`ui-button ui-button-${variant}${className ? ` ${className}` : ""}`} {...props} />;
}

export function IconButton({ label, className = "", ...props }: ComponentPropsWithRef<"button"> & { label: string }) {
  return <button type="button" className={`ui-icon-button${className ? ` ${className}` : ""}`} aria-label={label} {...props} />;
}

export function SelectField({ label, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <label className={`ui-select-field${className ? ` ${className}` : ""}`}><span>{label}</span><select aria-label={label} {...props} /></label>;
}

export function FilterChip({ active = false, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return <button type="button" className={`ui-filter-chip${active ? " is-active" : ""}${className ? ` ${className}` : ""}`} aria-pressed={active} {...props}>{children}</button>;
}

export function StatusBadge({ children, tone = "available", className = "" }: { children: ReactNode; tone?: "available" | "error" | "warning" | "info"; className?: string }) {
  return <span className={`ui-status-badge ui-status-badge-${tone}${className ? ` ${className}` : ""}`}>{children}</span>;
}

export function SectionHeading({ eyebrow, children, className = "", id }: { eyebrow?: string; children: ReactNode; className?: string; id?: string }) {
  return <div className={`ui-section-heading${className ? ` ${className}` : ""}`}>{eyebrow && <span>{eyebrow}</span>}<h2 id={id}>{children}</h2></div>;
}

export function CardSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ui-card-surface${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function TextLink({ className = "", children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return <a className={`ui-text-link ${className}`} {...props}>{children}</a>;
}

export function Divider({ className = "", ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={`ui-divider ${className}`} {...props} />;
}
