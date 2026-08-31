"use client";

import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { useFilter } from "react-aria";
import { useMemo } from "react";
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  type Key,
} from "react-aria-components";
import BprsMark from "./BprsMark";

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
}: CatalogComboboxProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const visibleOptions = useMemo(() => {
    const query = inputValue.trim();
    if (!query) return options;
    return options.filter((option) => contains(option.label, query) || contains(option.supporting ?? "", query));
  }, [contains, inputValue, options]);

  function select(key: Key | null) {
    if (key !== null) onSelectionChange(String(key));
  }

  return (
    <ComboBox<CatalogFilterOption>
      className="catalog-combobox"
      items={visibleOptions}
      selectedKey={selectedKey}
      inputValue={inputValue}
      menuTrigger="focus"
      onInputChange={onInputChange}
      onSelectionChange={select}
    >
      <Label>{label}</Label>
      <div className="catalog-combobox-control">
        <MagnifyingGlass aria-hidden="true" />
        <Input placeholder={placeholder} autoComplete="off" />
        <Button className="catalog-combobox-trigger" aria-label={`Buka pilihan ${label}`}>
          <CaretDown aria-hidden="true" />
        </Button>
      </div>
      <Popover className="catalog-combobox-popover" offset={8} placement="bottom start">
        <ListBox<CatalogFilterOption> className="catalog-combobox-list" renderEmptyState={() => <div className="catalog-combobox-empty">{emptyMessage}</div>}>
          {(option) => (
            <ListBoxItem className="catalog-combobox-option" id={option.id} textValue={option.label}>
              {({ isSelected }) => (
                <>
                  {option.markUrl ? <BprsMark profile={{ name: option.label, slug: option.id, markUrl: option.markUrl }} compact /> : null}
                  <span className="catalog-combobox-copy">
                    <strong>{option.label}</strong>
                    {option.supporting ? <small>{option.supporting}</small> : null}
                  </span>
                  {isSelected ? <Check weight="bold" aria-hidden="true" /> : null}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
