"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
} from "@/components/ui/combobox";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
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
import { SheetClose, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { MerchantListItemDto } from "@/features/merchants/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { formatMoney } from "@/lib/format";

type MerchantOption = {
  value: string;
  label: string;
  helper: string;
};

type TownshipOption = {
  value: string;
  label: string;
  helper: string;
  baseFee: number;
};

type CreateParcelFormProps = Readonly<{
  merchants: MerchantListItemDto[];
  townships: TownshipListItemDto[];
  title?: string;
  submitLabel?: string;
  initialValues?: ParcelFormInitialValues;
}>;

type ParcelDimensions = {
  estimatedWeight: string;
  width: string;
  height: string;
  length: string;
};

export type ParcelFormInitialValues = {
  merchantName?: string;
  receiverName?: string;
  receiverPhoneNumber?: string;
  receiverAddress?: string;
  specialNotes?: string;
  townshipName?: string;
  deliveryFee?: string;
  hasCod?: boolean;
  codFee?: string;
  dimensions?: Partial<ParcelDimensions>;
};

const inputClassName =
  "h-10 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none placeholder:text-sm placeholder:text-[#9a9794] focus-visible:border-[#1b1938] focus-visible:ring-[#c9b4fa]";

const groupedInputClassName =
  "h-10 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-[#1b1938] has-[[data-slot=input-group-control]:focus-visible]:ring-[#c9b4fa]";

const textareaClassName =
  "min-h-28 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none placeholder:text-sm placeholder:text-[#9a9794] focus-visible:border-[#1b1938] focus-visible:ring-[#c9b4fa]";

export function CreateParcelForm({
  merchants,
  townships,
  title = "Create Parcel",
  submitLabel = "Create Parcel",
  initialValues,
}: CreateParcelFormProps) {
  const overlayContainerRef = useRef<HTMLFormElement>(null);
  const merchantId = useId();
  const receiverNameId = useId();
  const receiverPhoneId = useId();
  const receiverAddressId = useId();
  const specialNotesId = useId();
  const townshipId = useId();
  const deliveryFeeId = useId();
  const codFeeId = useId();
  const codCheckboxId = useId();
  const parcelDimensionsId = useId();

  const merchantOptions: MerchantOption[] = merchants.map((merchant) => ({
    value: merchant.id,
    label: merchant.shopName,
    helper: `${merchant.ownerName} • ${merchant.phoneNumber}`,
  }));

  const townshipOptions: TownshipOption[] = townships
    .filter((township) => township.isActive)
    .map((township) => ({
      value: township.id,
      label: township.name,
      helper: `${formatMoney(township.baseFee)} MMK base fee`,
      baseFee: township.baseFee,
    }));

  const initialMerchant =
    merchantOptions.find((option) => option.label === initialValues?.merchantName) ?? null;
  const initialTownship =
    townshipOptions.find((option) => option.label === initialValues?.townshipName) ?? null;

  const [selectedMerchant, setSelectedMerchant] = useState<MerchantOption | null>(initialMerchant);
  const [receiverName, setReceiverName] = useState(initialValues?.receiverName ?? "");
  const [receiverPhoneNumber, setReceiverPhoneNumber] = useState(initialValues?.receiverPhoneNumber ?? "");
  const [receiverAddress, setReceiverAddress] = useState(initialValues?.receiverAddress ?? "");
  const [specialNotes, setSpecialNotes] = useState(initialValues?.specialNotes ?? "");
  const [selectedTownship, setSelectedTownship] = useState<TownshipOption | null>(initialTownship);
  const [deliveryFee, setDeliveryFee] = useState(
    initialValues?.deliveryFee ?? (initialTownship ? String(initialTownship.baseFee) : ""),
  );
  const [hasCod, setHasCod] = useState(initialValues?.hasCod ?? false);
  const [codFee, setCodFee] = useState(initialValues?.codFee ?? "");
  const [dimensions, setDimensions] = useState<ParcelDimensions>({
    estimatedWeight: initialValues?.dimensions?.estimatedWeight ?? "",
    width: initialValues?.dimensions?.width ?? "",
    height: initialValues?.dimensions?.height ?? "",
    length: initialValues?.dimensions?.length ?? "",
  });

  return (
    <form
      ref={overlayContainerRef}
      className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      {/* <div className="border-b border-[#e7dfd8] p-6">
        <div className="rounded-[28px] bg-[radial-gradient(circle_at_top,#c9b4fa_0%,#1b1938_34%,#0e0c1f_100%)] p-6 text-white shadow-[0_24px_80px_rgba(14,12,31,0.28)]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white/75">
              Draft Intake
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">No submit action</span>
          </div>
          <SheetHeader className="space-y-3 text-left">
            <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em] text-white">Create Parcel</SheetTitle>
            <SheetDescription className="max-w-md text-sm leading-6 text-white/72">
              Capture merchant, receiver, township, and COD details in a styled right-side sheet. This pass is
              presentation only, so submit stays inactive.
            </SheetDescription>
          </SheetHeader>
        </div>
      </div> */}
      <SheetHeader className="border-b border-[#e7dfd8] p-6 pb-4 space-y-3 text-left">
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">
          {title}
        </SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
        <div className="space-y-5">
          <Card className="border-[#e7dfd8] bg-white shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
            <CardContent className="space-y-4">
              <FieldShell htmlFor={merchantId} label="Merchant">
                <Combobox
                  items={merchantOptions}
                  value={selectedMerchant}
                  onValueChange={(nextValue) => setSelectedMerchant(nextValue ?? null)}
                  itemToStringLabel={(option) => option.label}
                  isItemEqualToValue={(item, value) => item.value === value.value}
                >
                  <ComboboxInput
                    id={merchantId}
                    aria-label="Select merchant"
                    placeholder="Search merchant by name"
                    showClear={selectedMerchant !== null}
                    className={groupedInputClassName}
                  />
                  <ComboboxContent className="z-50" portalContainer={overlayContainerRef}>
                    <ComboboxEmpty>No merchants found.</ComboboxEmpty>
                    <ComboboxCollection>
                      {(option: MerchantOption) => (
                        <ComboboxItem key={option.value} value={option} className="py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-[#292827]">{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.helper}</span>
                          </div>
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxContent>
                </Combobox>
              </FieldShell>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell htmlFor={receiverNameId} label="Receiver name">
                  <Input
                    id={receiverNameId}
                    placeholder="Enter receiver name"
                    value={receiverName}
                    onChange={(event) => setReceiverName(event.target.value)}
                    className={inputClassName}
                  />
                </FieldShell>
                <FieldShell htmlFor={receiverPhoneId} label="Receiver phone number">
                  <Input
                    id={receiverPhoneId}
                    placeholder="09xxxxxxxxx"
                    value={receiverPhoneNumber}
                    onChange={(event) => setReceiverPhoneNumber(event.target.value)}
                    className={inputClassName}
                  />
                </FieldShell>
              </div>

              <FieldShell htmlFor={receiverAddressId} label="Receiver address">
                <Textarea
                  id={receiverAddressId}
                  placeholder="Street, ward, landmark, building"
                  value={receiverAddress}
                  onChange={(event) => setReceiverAddress(event.target.value)}
                  className={textareaClassName}
                />
              </FieldShell>

              <FieldShell htmlFor={specialNotesId} label="Special note">
                <Textarea
                  id={specialNotesId}
                  placeholder="Delivery instructions, gate code, landmark, or handling note"
                  value={specialNotes}
                  onChange={(event) => setSpecialNotes(event.target.value)}
                  className={textareaClassName}
                />
              </FieldShell>

              <FieldShell htmlFor={townshipId} label="Receiver township">
                <Combobox
                  items={townshipOptions}
                  value={selectedTownship}
                  onValueChange={(nextValue) => {
                    const township = nextValue ?? null;

                    setSelectedTownship(township);
                    setDeliveryFee(township ? String(township.baseFee) : "");
                  }}
                  itemToStringLabel={(option) => option.label}
                  isItemEqualToValue={(item, value) => item.value === value.value}
                >
                  <ComboboxInput
                    id={townshipId}
                    aria-label="Select receiver township"
                    placeholder="Search township"
                    showClear={selectedTownship !== null}
                    className={groupedInputClassName}
                  />
                  <ComboboxContent className="z-50" portalContainer={overlayContainerRef}>
                    <ComboboxEmpty>No townships found.</ComboboxEmpty>
                    <ComboboxCollection>
                      {(option: TownshipOption) => (
                        <ComboboxItem key={option.value} value={option} className="py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-[#292827]">{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.helper}</span>
                          </div>
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxContent>
                </Combobox>
                <p className="text-xs text-[#73706d] mt-1">
                  {selectedTownship
                    ? `Base delivery fee from township pricing: ${formatMoney(selectedTownship.baseFee)} MMK`
                    : "Selecting a township pre-fills the base delivery fee."}
                </p>
              </FieldShell>

              <FieldShell htmlFor={parcelDimensionsId} label="Parcel dimensions">
                <DimensionsPopover
                  id={parcelDimensionsId}
                  dimensions={dimensions}
                  onChange={(key, value) => {
                    setDimensions((current) => ({
                      ...current,
                      [key]: value,
                    }));
                  }}
                />
              </FieldShell>
              
              <FieldShell htmlFor={deliveryFeeId} label="Delivery fee">
                <MoneyInput
                  id={deliveryFeeId}
                  value={deliveryFee}
                  onChange={setDeliveryFee}
                  placeholder="0"
                />
              </FieldShell>

              {hasCod ? (
                <FieldShell htmlFor={codFeeId} label="COD fee">
                  <MoneyInput id={codFeeId} value={codFee} onChange={setCodFee} placeholder="0" />
                </FieldShell>
              ) : null}

              <label
                htmlFor={codCheckboxId}
                className="flex cursor-pointer gap-3 transition-colors"
              >
                <Checkbox
                  id={codCheckboxId}
                  checked={hasCod}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true;

                    setHasCod(enabled);

                    if (!enabled) {
                      setCodFee("");
                    }
                  }}
                  className="mt-0.5"
                />
                <p className="text-sm font-medium text-[#292827]">Cash on delivery</p>
              </label>
            </CardContent>
          </Card>
        </div>
      </div>

      <SheetFooter className="border-t border-[#e7dfd8] bg-white px-6 py-4 justify-end mt-0">
        <div className="flex items-center gap-2">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" className="bg-[#1b1938] text-white hover:bg-[#0e0c1f]">
            {submitLabel}
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}

function FieldShell({
  htmlFor,
  label,
  children,
}: Readonly<{
  htmlFor: string;
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-2.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-[#292827]">
        {label}
      </Label>
      <div>{children}</div>
    </div>
  );
}

function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
}: Readonly<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}>) {
  return (
    <InputGroup className={groupedInputClassName}>
      <InputGroupAddon align="inline-start">
        <InputGroupText className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#73706d]">
          Ks
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="number"
        min="0"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full px-2 text-sm text-[#292827] placeholder:text-[#9a9794]"
      />
    </InputGroup>
  );
}

function DimensionsPopover({
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
