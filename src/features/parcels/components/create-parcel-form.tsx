"use client";

import type { SubmitEvent } from "react";
import { useId, useRef, useState, useTransition } from "react";

import {
  FieldShell,
  FormBanner,
  MoneyInput,
  groupedInputClassName,
  inputClassName,
  textareaClassName,
  type FormMessageState,
} from "@/components/shared/form-fields";
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
import { Input } from "@/components/ui/input";
import { SheetClose, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { MerchantListItemDto } from "@/features/merchants/server/dto";
import {
  buildMerchantOptions,
  buildTownshipOptions,
  DimensionsPopover,
  type MerchantOption,
  type ParcelDimensions,
  type TownshipOption,
} from "@/features/parcels/components/parcel-form-support";
import { createParcelAction } from "@/features/parcels/server/actions";
import type { CreateParcelFormInputDto } from "@/features/parcels/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { formatMoney } from "@/lib/format";

type CreateParcelFormProps = Readonly<{
  merchants: MerchantListItemDto[];
  townships: TownshipListItemDto[];
}>;

export function CreateParcelForm({ merchants, townships }: CreateParcelFormProps) {
  const overlayContainerRef = useRef<HTMLFormElement>(null);
  const merchantId = useId();
  const receiverNameId = useId();
  const receiverPhoneId = useId();
  const receiverAddressId = useId();
  const specialNotesId = useId();
  const townshipId = useId();
  const deliveryFeeId = useId();
  const codAmountId = useId();
  const codCheckboxId = useId();
  const parcelDimensionsId = useId();

  const [isPending, startTransition] = useTransition();
  const merchantOptions = buildMerchantOptions(merchants);
  const townshipOptions = buildTownshipOptions(townships);

  const [selectedMerchant, setSelectedMerchant] = useState<MerchantOption | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhoneNumber, setReceiverPhoneNumber] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [selectedTownship, setSelectedTownship] = useState<TownshipOption | null>(null);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [hasCod, setHasCod] = useState(false);
  const [codAmount, setCodAmount] = useState("");
  const [dimensions, setDimensions] = useState<ParcelDimensions>({
    estimatedWeight: "",
    width: "",
    height: "",
    length: "",
  });
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);

  function clearBanner() {
    if (submissionState) {
      setSubmissionState(null);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionState(null);

    const formInput: CreateParcelFormInputDto = {
      merchantId: selectedMerchant?.value ?? "",
      receiverName,
      receiverPhoneNumber,
      receiverAddress,
      specialNotes,
      townshipId: selectedTownship?.value ?? "",
      deliveryFee,
      hasCod,
      codAmount,
      dimensions,
    };

    startTransition(async () => {
      const result = await createParcelAction(formInput);

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });

        return;
      }

      setSubmissionState({
        kind: "success",
        message: `${result.parcel.receiverName}'s parcel is ready to save.`,
        detail: "This mock flow validates parcel intake details without persistence yet.",
      });
    });
  }

  return (
    <form
      ref={overlayContainerRef}
      className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]"
      onSubmit={handleSubmit}
    >
      <SheetHeader className="space-y-3 border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">
          Create Parcel
        </SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <div className="space-y-5">
          {submissionState ? <FormBanner state={submissionState} /> : null}

          <Card className="border-[#e7dfd8] bg-white shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
            <CardContent className="space-y-4">
              <FieldShell htmlFor={merchantId} label="Merchant">
                <Combobox
                  items={merchantOptions}
                  value={selectedMerchant}
                  onValueChange={(nextValue) => {
                    setSelectedMerchant(nextValue ?? null);
                    clearBanner();
                  }}
                  itemToStringLabel={(option) => option.label}
                  isItemEqualToValue={(item, value) => item.value === value.value}
                >
                  <ComboboxInput
                    id={merchantId}
                    aria-label="Select merchant"
                    placeholder="Search merchant by name"
                    showClear={selectedMerchant !== null}
                    className={groupedInputClassName}
                    disabled={isPending}
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
                    onChange={(event) => {
                      setReceiverName(event.target.value);
                      clearBanner();
                    }}
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>
                <FieldShell htmlFor={receiverPhoneId} label="Receiver phone number">
                  <Input
                    id={receiverPhoneId}
                    placeholder="09xxxxxxxxx"
                    value={receiverPhoneNumber}
                    onChange={(event) => {
                      setReceiverPhoneNumber(event.target.value);
                      clearBanner();
                    }}
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>
              </div>

              <FieldShell htmlFor={receiverAddressId} label="Receiver address">
                <Textarea
                  id={receiverAddressId}
                  placeholder="Street, ward, landmark, building"
                  value={receiverAddress}
                  onChange={(event) => {
                    setReceiverAddress(event.target.value);
                    clearBanner();
                  }}
                  className={textareaClassName}
                  disabled={isPending}
                />
              </FieldShell>

              <FieldShell htmlFor={specialNotesId} label="Special note">
                <Textarea
                  id={specialNotesId}
                  placeholder="Delivery instructions, gate code, landmark, or handling note"
                  value={specialNotes}
                  onChange={(event) => {
                    setSpecialNotes(event.target.value);
                    clearBanner();
                  }}
                  className={textareaClassName}
                  disabled={isPending}
                />
              </FieldShell>

              <FieldShell htmlFor={townshipId} label="Receiver township">
                <Combobox
                  items={townshipOptions}
                  value={selectedTownship}
                  onValueChange={(township = null) => {
                    setSelectedTownship(township);
                    setDeliveryFee(township ? String(township.baseFee) : "");
                    clearBanner();
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
                    disabled={isPending}
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
                <p className="mt-1 text-xs text-[#73706d]">
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
                    clearBanner();
                  }}
                />
              </FieldShell>

              <FieldShell htmlFor={deliveryFeeId} label="Delivery fee">
                <MoneyInput
                  id={deliveryFeeId}
                  value={deliveryFee}
                  onChange={(value) => {
                    setDeliveryFee(value);
                    clearBanner();
                  }}
                  placeholder="0"
                  disabled={isPending}
                />
              </FieldShell>

              {hasCod ? (
                <FieldShell htmlFor={codAmountId} label="COD amount">
                  <MoneyInput
                    id={codAmountId}
                    value={codAmount}
                    onChange={(value) => {
                      setCodAmount(value);
                      clearBanner();
                    }}
                    placeholder="0"
                    disabled={isPending}
                  />
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
                    const enabled = checked;

                    setHasCod(enabled);
                    clearBanner();

                    if (!enabled) {
                      setCodAmount("");
                    }
                  }}
                  className="mt-0.5"
                  disabled={isPending}
                />
                <p className="text-sm font-medium text-[#292827]">Cash on delivery</p>
              </label>
            </CardContent>
          </Card>
        </div>
      </div>

      <SheetFooter className="mt-0 justify-end border-t border-[#e7dfd8] bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            className="bg-[#1b1938] text-white hover:bg-[#0e0c1f]"
            disabled={isPending}
          >
            {isPending ? "Validating..." : "Create Parcel"}
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}
