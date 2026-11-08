"use client";

import { useId, useRef, useState, type InputHTMLAttributes } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

export default function SearchField({ label, hideLabel = false, className = "", onClear, clearLabel, value, defaultValue, onChange, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hideLabel?: boolean; onClear?: () => void; clearLabel?: string }) {
  const generatedId = useId(), inputId = id ?? generatedId;
  const ref = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(defaultValue ?? "");
  const current = value ?? localValue;
  return <div className={`ui-search-input sj-search-field ${className}`}>
    <label htmlFor={inputId} className={hideLabel ? "sr-only" : undefined}>{label}</label>
    <div className="sj-search-field-control">
      <MagnifyingGlass aria-hidden="true" />
      <input {...props} ref={ref} id={inputId} type="search" aria-label={label} value={current} onChange={event => { setLocalValue(event.target.value); onChange?.(event); }} />
      {String(current).length > 0 && (value === undefined || onClear) && <button type="button" aria-label={clearLabel ?? `Hapus ${label.toLocaleLowerCase("id-ID")}`} disabled={props.disabled} onClick={() => { setLocalValue(""); onClear?.(); ref.current?.focus(); }}><X aria-hidden="true" /></button>}
    </div>
  </div>;
}
