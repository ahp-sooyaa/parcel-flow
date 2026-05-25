"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  FieldShell,
  type FormFieldErrors,
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

type CreateParcelFormValues = {
  selectedMerchant: MerchantOption | null;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverAddress: string;
  specialNotes: string;
  selectedTownship: TownshipOption | null;
  deliveryFee: string;
  hasCod: boolean;
  codAmount: string;
  dimensions: ParcelDimensions;
};

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

  const initialValues: CreateParcelFormValues = {
    selectedMerchant: null,
    receiverName: "",
    receiverPhoneNumber: "",
    receiverAddress: "",
    specialNotes: "",
    selectedTownship: null,
    deliveryFee: "",
    hasCod: false,
    codAmount: "",
    dimensions: {
      estimatedWeight: "",
      width: "",
      height: "",
      length: "",
    },
  };
  const { clearErrors, formState, handleSubmit, reset, setError, setValue, watch } =
    useForm<CreateParcelFormValues>({
      defaultValues: initialValues,
    });
  const values = watch();
  const errors = formState.errors;
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);

  function clearFeedback(field?: keyof CreateParcelFormValues) {
    if (field) {
      clearErrors(field);
    }

    if (submissionState?.kind === "error") {
      setSubmissionState(null);
    }
  }

  function applyFieldErrors(fieldErrors?: FormFieldErrors) {
    if (!fieldErrors) {
      return false;
    }

    const mappings = [
      ["merchantId", "selectedMerchant"],
      ["receiverName", "receiverName"],
      ["receiverPhoneNumber", "receiverPhoneNumber"],
      ["receiverAddress", "receiverAddress"],
      ["townshipId", "selectedTownship"],
      ["deliveryFee", "deliveryFee"],
      ["codAmount", "codAmount"],
    ] as const;

    let hasMappedError = false;

    for (const [source, target] of mappings) {
      const message = fieldErrors[source];

      if (!message) {
        continue;
      }

      hasMappedError = true;
      setError(target, { type: "server", message });
    }

    return hasMappedError;
  }

  function submitForm(formValues: typeof values) {
    setSubmissionState(null);
    clearErrors();

    const formInput: CreateParcelFormInputDto = {
      merchantId: formValues.selectedMerchant?.value ?? "",
      receiverName: formValues.receiverName,
      receiverPhoneNumber: formValues.receiverPhoneNumber,
      receiverAddress: formValues.receiverAddress,
      specialNotes: formValues.specialNotes,
      townshipId: formValues.selectedTownship?.value ?? "",
      deliveryFee: formValues.deliveryFee,
      hasCod: formValues.hasCod,
      codAmount: formValues.codAmount,
      dimensions: formValues.dimensions,
    };

    startTransition(async () => {
      const result = await createParcelAction(formInput);

      if (!result.ok) {
        const hasMappedError = applyFieldErrors(result.fieldErrors);

        if (!hasMappedError || !result.fieldErrors) {
          setSubmissionState({
            kind: "error",
            message: result.message,
          });
        }

        return;
      }

      reset(initialValues);
      clearErrors();
      setSubmissionState({
        kind: "success",
        message: `${result.parcel.receiverName}'s parcel has been created.`,
        detail: `Parcel code: ${result.parcel.parcelCode}`,
      });
    });
  }

  return (
    <form
      ref={overlayContainerRef}
      className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]"
      onSubmit={handleSubmit(submitForm)}
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
              <FieldShell
                htmlFor={merchantId}
                label="Merchant"
                required
                error={errors.selectedMerchant?.message}
              >
                <Combobox
                  items={merchantOptions}
                  value={values.selectedMerchant}
                  onValueChange={(nextValue) => {
                    setValue("selectedMerchant", nextValue ?? null);
                    clearFeedback("selectedMerchant");
                  }}
                  itemToStringLabel={(option) => option?.label ?? ""}
                  isItemEqualToValue={(item, value) => item?.value === value?.value}
                >
                  <ComboboxInput
                    id={merchantId}
                    aria-label="Select merchant"
                    placeholder="Search merchant by name"
                    aria-invalid={Boolean(errors.selectedMerchant)}
                    showClear={values.selectedMerchant !== null}
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
                <FieldShell
                  htmlFor={receiverNameId}
                  label="Receiver name"
                  required
                  error={errors.receiverName?.message}
                >
                  <Input
                    id={receiverNameId}
                    placeholder="Enter receiver name"
                    aria-invalid={Boolean(errors.receiverName)}
                    value={values.receiverName}
                    onChange={(event) => {
                      setValue("receiverName", event.target.value);
                      clearFeedback("receiverName");
                    }}
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>
                <FieldShell
                  htmlFor={receiverPhoneId}
                  label="Receiver phone number"
                  required
                  error={errors.receiverPhoneNumber?.message}
                >
                  <Input
                    id={receiverPhoneId}
                    placeholder="09xxxxxxxxx"
                    aria-invalid={Boolean(errors.receiverPhoneNumber)}
                    value={values.receiverPhoneNumber}
                    onChange={(event) => {
                      setValue("receiverPhoneNumber", event.target.value);
                      clearFeedback("receiverPhoneNumber");
                    }}
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>
              </div>

              <FieldShell
                htmlFor={receiverAddressId}
                label="Receiver address"
                required
                error={errors.receiverAddress?.message}
              >
                <Textarea
                  id={receiverAddressId}
                  placeholder="Street, ward, landmark, building"
                  aria-invalid={Boolean(errors.receiverAddress)}
                  value={values.receiverAddress}
                  onChange={(event) => {
                    setValue("receiverAddress", event.target.value);
                    clearFeedback("receiverAddress");
                  }}
                  className={textareaClassName}
                  disabled={isPending}
                />
              </FieldShell>

              <FieldShell htmlFor={specialNotesId} label="Special note">
                <Textarea
                  id={specialNotesId}
                  placeholder="Delivery instructions, gate code, landmark, or handling note"
                  value={values.specialNotes}
                  onChange={(event) => {
                    setValue("specialNotes", event.target.value);
                    clearFeedback("specialNotes");
                  }}
                  className={textareaClassName}
                  disabled={isPending}
                />
              </FieldShell>

              <FieldShell
                htmlFor={townshipId}
                label="Receiver township"
                required
                error={errors.selectedTownship?.message}
              >
                <Combobox
                  items={townshipOptions}
                  value={values.selectedTownship}
                  onValueChange={(township = null) => {
                    setValue("selectedTownship", township);
                    setValue("deliveryFee", township ? String(township.baseFee) : "");
                    clearFeedback("selectedTownship");
                    clearErrors("deliveryFee");
                  }}
                  itemToStringLabel={(option) => option?.label ?? ""}
                  isItemEqualToValue={(item, value) => item?.value === value?.value}
                >
                  <ComboboxInput
                    id={townshipId}
                    aria-label="Select receiver township"
                    placeholder="Search township"
                    aria-invalid={Boolean(errors.selectedTownship)}
                    showClear={values.selectedTownship !== null}
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
                  {values.selectedTownship
                    ? `Base delivery fee from township pricing: ${formatMoney(values.selectedTownship.baseFee)} MMK`
                    : "Selecting a township pre-fills the base delivery fee."}
                </p>
              </FieldShell>

              <FieldShell htmlFor={parcelDimensionsId} label="Parcel dimensions">
                <DimensionsPopover
                  id={parcelDimensionsId}
                  dimensions={values.dimensions}
                  onChange={(key, value) => {
                    setValue("dimensions", {
                      ...values.dimensions,
                      [key]: value,
                    });
                    clearFeedback("dimensions");
                  }}
                />
              </FieldShell>

              <FieldShell
                htmlFor={deliveryFeeId}
                label="Delivery fee"
                required
                error={errors.deliveryFee?.message}
              >
                <MoneyInput
                  id={deliveryFeeId}
                  value={values.deliveryFee}
                  onChange={(value) => {
                    setValue("deliveryFee", value);
                    clearFeedback("deliveryFee");
                  }}
                  placeholder="0"
                  disabled={isPending}
                />
              </FieldShell>

              {values.hasCod ? (
                <FieldShell
                  htmlFor={codAmountId}
                  label="COD amount"
                  required
                  error={errors.codAmount?.message}
                >
                  <MoneyInput
                    id={codAmountId}
                    value={values.codAmount}
                    onChange={(value) => {
                      setValue("codAmount", value);
                      clearFeedback("codAmount");
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
                  checked={values.hasCod}
                  onCheckedChange={(checked) => {
                    const enabled = checked;

                    setValue("hasCod", enabled);
                    clearFeedback("hasCod");

                    if (!enabled) {
                      setValue("codAmount", "");
                      clearErrors("codAmount");
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
            {isPending ? "Creating..." : "Create Parcel"}
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}
