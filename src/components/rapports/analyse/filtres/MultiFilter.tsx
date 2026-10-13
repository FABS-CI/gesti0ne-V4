import { useState } from "react";
import { FilterTrigger } from "./FilterTrigger";
import { FilterOptionList, type FilterSection } from "./FilterOptionList";

export function MultiFilter({
  label,
  sections,
  selected,
  onChange,
  labelOf,
}: {
  label: string;
  sections: FilterSection[];
  selected: string[];
  onChange: (next: string[]) => void;
  labelOf: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const hint = selected.length ? selected.map(labelOf).join(", ") : undefined;
  return (
    <FilterTrigger
      label={label}
      count={selected.length}
      hint={hint}
      open={open}
      onOpenChange={setOpen}
    >
      <FilterOptionList label={label} sections={sections} selected={selected} onChange={onChange} />
    </FilterTrigger>
  );
}
