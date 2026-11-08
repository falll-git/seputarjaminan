"use client";

import { Buildings, CaretDown, Check, MagnifyingGlass, MapPin, X } from "@phosphor-icons/react";
import { useFilter } from "react-aria";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Button,
  ComboBox,
  ComboBoxStateContext,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  type Key,
} from "react-aria-components";
import BprsMark from "./BprsMark";
import StateIllustration from "./StateIllustration";
import styles from "./CatalogControls.module.css";

function PickerInput({ placeholder, maxLength, inputRef, moreRef }: { placeholder: string; maxLength?: number; inputRef: RefObject<HTMLInputElement | null>; moreRef: RefObject<HTMLButtonElement | null> }) {
  const state = useContext(ComboBoxStateContext);
  return <Input ref={inputRef} placeholder={placeholder} autoComplete="off" maxLength={maxLength} onKeyDownCapture={event => {
    // ComboBox normally commits on Tab. A paged picker also has a real footer
    // action: let keyboard users reach it without selecting the focused option.
    if (event.key === "Tab" && !event.shiftKey && state?.isOpen && moreRef.current) {
      event.preventDefault(); event.stopPropagation();
      // Wait until the overlay focus-scope has handled this key event. Moving
      // focus during capture would make it treat this same Tab as an exit.
      requestAnimationFrame(()=>moreRef.current?.focus());
    }
    if (event.key === "Escape" && state?.isOpen) {
      event.preventDefault();
      event.stopPropagation();
      state.toggle(null, "manual");
    }
  }} />;
}

function ClearPicker({ label, onClear, inputRef }: { label: string; onClear: () => void; inputRef: RefObject<HTMLInputElement | null> }) {
  const state = useContext(ComboBoxStateContext);
  return <Button slot={null} className={styles.clear} aria-label={`Hapus ${label.toLowerCase()}`} onPress={() => {
    onClear();
    if (state?.isOpen) state.toggle(null, "manual");
    requestAnimationFrame(()=>inputRef.current?.focus());
  }}><X aria-hidden="true" /></Button>;
}

function PickerPopover({ children, triggerRef, inputRef }: { children: ReactNode; triggerRef: RefObject<HTMLDivElement | null>; inputRef: RefObject<HTMLInputElement | null> }) {
  const state = useContext(ComboBoxStateContext);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const returnToInput = (event: KeyboardEvent) => {
      if (state?.isOpen && event.key === "Tab" && event.shiftKey && event.target instanceof HTMLElement &&
        event.target.hasAttribute("data-picker-action") && contentRef.current?.contains(event.target)) {
        // Handle the inverse path before the portal's document focus restoration.
        event.preventDefault(); event.stopImmediatePropagation(); inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", returnToInput, true);
    return () => window.removeEventListener("keydown", returnToInput, true);
  }, [state, inputRef]);
  useEffect(() => {
    const layout = window.matchMedia("(max-width: 920px)");
    const close = () => { if (state?.isOpen) state.toggle(null, "manual"); };
    layout.addEventListener("change", close);
    return () => layout.removeEventListener("change", close);
  }, [state]);
  return <Popover triggerRef={triggerRef} className={styles.popover} offset={8} placement="bottom start"><div ref={contentRef} className={styles.pickerContents} onKeyDownCapture={event=>{
    if(event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      // close() commits a selection; Escape must only dismiss the picker.
      if (state?.isOpen) state.toggle(null, "manual");
      requestAnimationFrame(()=>inputRef.current?.focus());
    }
  }}>{children}</div></Popover>;
}

export type CatalogFilterOption = {
  id: string;
  label: string;
  supporting?: string;
  markUrl?: string;
};

type CatalogComboboxProps = {
  label: string;
  placeholder: string;
  emptyMessage: string;
  options: CatalogFilterOption[];
  selectedKey: Key | null;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSelectionChange: (key: string) => void;
  allowsCustomValue?: boolean;
  description?: string;
  onClear?: () => void;
  loading?: boolean;
  status?: string;
  moreLabel?: string;
  onLoadMore?: () => void;
  failed?: boolean;
};

export default function CatalogCombobox({
  label,
  placeholder,
  emptyMessage,
  options,
  selectedKey,
  inputValue,
  onInputChange,
  onSelectionChange,
  allowsCustomValue = false,
  description,
  onClear,
  loading = false,
  status,
  moreLabel,
  onLoadMore,
  failed = false,
}: CatalogComboboxProps) {
  const controlRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [requestedMore, setRequestedMore] = useState(false);
  const { contains } = useFilter({ sensitivity: "base" });
  const visibleOptions = useMemo(() => {
    const query = inputValue.trim();
    if (!query || options.some(option => option.id === selectedKey && option.label === query)) return options;
    return options.filter((option) => contains(option.label, query) || contains(option.supporting ?? "", query));
  }, [contains, inputValue, options, selectedKey]);

  function select(key: Key | null) {
    if (key !== null) onSelectionChange(String(key));
  }

  return (
    <ComboBox<CatalogFilterOption>
      className={styles.combobox}
      items={visibleOptions}
      selectedKey={selectedKey}
      inputValue={inputValue}
      menuTrigger="input"
      allowsEmptyCollection
      allowsCustomValue={allowsCustomValue}
      onInputChange={onInputChange}
      onSelectionChange={select}
    >
      <Label>{label}</Label>
      <div ref={controlRef} className={styles.comboControl}>
        {allowsCustomValue ? <MapPin aria-hidden="true" /> : <MagnifyingGlass aria-hidden="true" />}
        <PickerInput placeholder={placeholder} maxLength={100} inputRef={inputRef} moreRef={moreRef} />
        <div className={styles.inputActions}>
          {inputValue && onClear && <ClearPicker label={label} onClear={onClear} inputRef={inputRef} />}
          <Button className={styles.comboTrigger} aria-label="Buka pilihan">
            <CaretDown aria-hidden="true" />
          </Button>
        </div>
      </div>
      {description && <Text slot="description" className="sr-only">{description}</Text>}
      <PickerPopover triggerRef={controlRef} inputRef={inputRef}>
        <div className={styles.pickerHeading}>{label}<span>{allowsCustomValue ? "Pilih atau ketik" : "Pilih dari daftar"}</span></div>
        <ListBox<CatalogFilterOption> className={styles.list} renderEmptyState={() => <div className={styles.empty}>{!loading && <StateIllustration scene={failed ? "error" : "search"} small />}<span>{emptyMessage}</span></div>}>
          {(option) => (
            <ListBoxItem className={styles.option} id={option.id} textValue={option.label}>
              {({ isSelected }) => (
                <>
                  <span className={styles.mark} aria-hidden="true">{allowsCustomValue ? <MapPin /> : option.id === "all" ? <Buildings /> : <BprsMark profile={{ name: option.label, slug: option.id, markUrl: option.markUrl ?? "" }} compact />}</span>
                  <span className={styles.copy}>
                    <Text slot="label">{option.label}</Text>
                    {option.supporting ? <Text slot="description">{option.supporting}</Text> : null}
                  </span>
                  <Check weight="bold" aria-hidden="true" style={{visibility:isSelected?"visible":"hidden"}} />
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
        {(description || status || onLoadMore || requestedMore) && <div className={styles.pickerFooter}>
          {(status || description) && <p role={status ? "status" : undefined}>{status || description}</p>}
          {(onLoadMore || requestedMore) && <Button ref={moreRef} data-picker-action slot={null} className={styles.more} aria-disabled={loading || !onLoadMore || undefined} onPress={()=>{if(!loading && onLoadMore) {setRequestedMore(true); onLoadMore();}}}>{loading ? "Memuat…" : onLoadMore ? moreLabel : "Akhir daftar pilihan"}</Button>}
        </div>}
      </PickerPopover>
    </ComboBox>
  );
}
