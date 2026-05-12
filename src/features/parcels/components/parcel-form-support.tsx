"use client";

import { useId } from "react";
import { ChevronDown, Ruler } from "lucide-react";

import { inputClassName } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MerchantListItemDto } from "@/features/merchants/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { formatMoney } from "@/lib/format";

export type MerchantOption = {
  value: string;
  label: string;
  helper: string;
};

export type TownshipOption = {
  value: string;
  label: string;
  helper: string;
  baseFee: number;
};

export type ParcelDimensions = {
  estimatedWeight: string;
  width: string;
  height: string;
  length: string;
};

export function buildMerchantOptions(merchants: MerchantListItemDto[]) {
  return merchants.map<MerchantOption>((merchant) => ({
    value: merchant.id,
    label: merchant.shopName,
    helper: `${merchant.ownerName} • ${merchant.phoneNumber}`,
  }));
}

export function buildTownshipOptions(townships: TownshipListItemDto[]) {
  return townships
    .filter((township) => township.isActive)
    .map<TownshipOption>((township) => ({
      value: township.id,
      label: township.name,
      helper: `${formatMoney(township.baseFee)} MMK base fee`,
      baseFee: township.baseFee,
    }));
}

export function DimensionsPopover({
  id,
  dimensions,
  onChange,
}: Readonly<{
  id: string;
  dimensions: ParcelDimensions;
  onChange: (key: keyof ParcelDimensions, value: string) => void;
}>) {
  const estimatedWeightId = useId();
  const widthId = useId();
  const heightId = useId();
  const lengthId = useId();
  const filledCount = Object.values(dimensions).filter(Boolean).length;
  const summary =
    filledCount === 0
      ? "Estimated weight, width, height, and length"
      : `${filledCount}/4 values added`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="h-auto w-full items-center justify-between rounded-md border-[#dcd4cd] bg-[#fcfbf8] px-3 py-2 text-left text-[#292827] shadow-none hover:bg-[#f6f2ed]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[#1b1938]">
              <Ruler className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-[#292827]">Open dimensions popover</span>
              <span className="truncate text-xs font-normal text-[#73706d]">{summary}</span>
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-[#73706d]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[320px] rounded-xl border-[#dcd4cd] bg-white p-4 shadow-[0_20px_50px_rgba(27,25,56,0.12)]"
      >
        <PopoverHeader className="gap-1.5">
          <PopoverTitle className="text-sm font-semibold text-[#292827]">Dimensions</PopoverTitle>
          <PopoverDescription className="text-xs leading-5 text-[#73706d]">
            Set the estimated parcel size for intake.
          </PopoverDescription>
        </PopoverHeader>

        <div className="grid gap-3">
          <DimensionInput
            id={estimatedWeightId}
            label="Estimated weight"
            placeholder="0"
            value={dimensions.estimatedWeight}
            onChange={(value) => onChange("estimatedWeight", value)}
          />
          <DimensionInput
            id={widthId}
            label="Width"
            placeholder="0"
            value={dimensions.width}
            onChange={(value) => onChange("width", value)}
          />
          <DimensionInput
            id={heightId}
            label="Height"
            placeholder="0"
            value={dimensions.height}
            onChange={(value) => onChange("height", value)}
          />
          <DimensionInput
            id={lengthId}
            label="Length"
            placeholder="0"
            value={dimensions.length}
            onChange={(value) => onChange("length", value)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DimensionInput({
  id,
  label,
  placeholder,
  value,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-[#292827]">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min="0"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </div>
  );
}
