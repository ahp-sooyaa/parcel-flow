"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SearchableComboboxOption = {
    value: string;
    label: string;
};

type SearchableComboboxProps = {
    options: readonly SearchableComboboxOption[];
    id: string;
    name: string;
    value: string;
    onValueChange: (value: string) => void;
    onInputValueChange?: (value: string) => void;
    placeholder: string;
    emptyLabel: string;
    disabled?: boolean;
    required?: boolean;
    allowClear?: boolean;
    className?: string;
    invalid?: boolean;
};

export function SearchableCombobox({
    options,
    id,
    name,
    value,
    onValueChange,
    onInputValueChange,
    placeholder,
    emptyLabel,
    disabled = false,
    required = false,
    allowClear = false,
    className,
    invalid = false,
}: Readonly<SearchableComboboxProps>) {
    const selectedOption = options.find((option) => option.value === value) ?? null;
    const [inputValue, setInputValue] = useState(selectedOption?.label ?? "");
    const skipSelectedValueSyncRef = useRef(false);

    useEffect(() => {
        if (skipSelectedValueSyncRef.current) {
            skipSelectedValueSyncRef.current = false;
            return;
        }

        setInputValue(selectedOption?.label ?? "");
    }, [selectedOption]);

    return (
        <ComboboxPrimitive.Root
            items={options}
            name={name}
            value={selectedOption}
            inputValue={inputValue}
            disabled={disabled}
            required={required}
            onValueChange={(nextValue) => {
                onValueChange(nextValue?.value ?? "");
                setInputValue(nextValue?.label ?? "");
            }}
            onInputValueChange={(nextInputValue) => {
                setInputValue(nextInputValue);
                onInputValueChange?.(nextInputValue);

                // Preserve the user's current search query when typing over an existing selection.
                if (selectedOption && nextInputValue !== selectedOption.label) {
                    skipSelectedValueSyncRef.current = true;
                    onValueChange("");
                }
            }}
        >
            <ComboboxPrimitive.InputGroup
                className={cn(
                    "flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-background transition-colors outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
                    {
                        "border-destructive focus-within:border-destructive focus-within:ring-destructive/20":
                            invalid,
                        "bg-input/50 opacity-50 dark:bg-input/80": disabled,
                    },
                    className,
                )}
            >
                <ComboboxPrimitive.Input
                    id={id}
                    placeholder={placeholder}
                    autoComplete="off"
                    aria-invalid={invalid || undefined}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                />

                {allowClear && value ? (
                    <button
                        type="button"
                        className="flex h-full items-center px-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                            skipSelectedValueSyncRef.current = true;
                            setInputValue("");
                            onInputValueChange?.("");
                            onValueChange("");
                        }}
                        disabled={disabled}
                        aria-label="Clear selection"
                    >
                        <XIcon className="size-4" />
                    </button>
                ) : null}

                <ComboboxPrimitive.Trigger
                    type="button"
                    className="flex h-full items-center px-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                    disabled={disabled}
                    aria-label="Toggle options"
                >
                    <ChevronDownIcon className="size-4" />
                </ComboboxPrimitive.Trigger>
            </ComboboxPrimitive.InputGroup>

            <ComboboxPrimitive.Portal>
                <ComboboxPrimitive.Positioner sideOffset={4} className="isolate z-50">
                    <ComboboxPrimitive.Popup
                        initialFocus={false}
                        className="relative isolate z-50 w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
                    >
                        <ComboboxPrimitive.Empty className="px-2.5 py-2 text-sm text-muted-foreground">
                            {emptyLabel}
                        </ComboboxPrimitive.Empty>

                        <ComboboxPrimitive.List className="max-h-60 overflow-y-auto p-1">
                            {(option: SearchableComboboxOption) => (
                                <ComboboxPrimitive.Item
                                    key={option.value}
                                    value={option}
                                    className="relative flex cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:font-medium"
                                >
                                    <span className="truncate">{option.label}</span>
                                    <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                                        <CheckIcon className="size-4" />
                                    </ComboboxPrimitive.ItemIndicator>
                                </ComboboxPrimitive.Item>
                            )}
                        </ComboboxPrimitive.List>
                    </ComboboxPrimitive.Popup>
                </ComboboxPrimitive.Positioner>
            </ComboboxPrimitive.Portal>
        </ComboboxPrimitive.Root>
    );
}
