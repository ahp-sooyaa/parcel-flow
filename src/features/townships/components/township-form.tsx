"use client";

import type { SubmitEvent } from "react";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FieldShell,
  FormBanner,
  MoneyInput,
  NumberInput,
  inputClassName,
  type FormMessageState,
} from "@/components/shared/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { createTownshipAction, updateTownshipAction } from "@/features/townships/server/actions";
import type { TownshipListItemDto } from "@/features/townships/server/dto";

type TownshipFormMode = "create" | "edit";

type TownshipFormProps = Readonly<{
  mode: TownshipFormMode;
  township?: TownshipListItemDto;
}>;

function getInitialValues(township?: TownshipListItemDto) {
  return {
    name: township?.name ?? "",
    baseFee: township ? String(township.baseFee) : "",
    baseWeightKg: township ? String(township.baseWeightKg) : "3",
    extraWeightFee: township ? String(township.extraWeightFee) : "0",
    extraWeightUnitKg: township ? String(township.extraWeightUnitKg) : "1",
    volumetricDivisor: township ? String(township.volumetricDivisor) : "5000",
    codFeePercent: township ? String(township.codFeePercent) : "0",
    returnFeePercent: township ? String(township.returnFeePercent) : "100",
    isActive: township?.isActive ?? true,
  };
}

export function TownshipForm({ mode, township }: TownshipFormProps) {
  const nameId = useId();
  const baseFeeId = useId();
  const baseWeightKgId = useId();
  const extraWeightFeeId = useId();
  const extraWeightUnitKgId = useId();
  const volumetricDivisorId = useId();
  const codFeePercentId = useId();
  const returnFeePercentId = useId();
  const [isPending, startTransition] = useTransition();
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const initialValues = getInitialValues(township);
  const [name, setName] = useState(initialValues.name);
  const [baseFee, setBaseFee] = useState(initialValues.baseFee);
  const [baseWeightKg, setBaseWeightKg] = useState(initialValues.baseWeightKg);
  const [extraWeightFee, setExtraWeightFee] = useState(initialValues.extraWeightFee);
  const [extraWeightUnitKg, setExtraWeightUnitKg] = useState(initialValues.extraWeightUnitKg);
  const [volumetricDivisor, setVolumetricDivisor] = useState(initialValues.volumetricDivisor);
  const [codFeePercent, setCodFeePercent] = useState(initialValues.codFeePercent);
  const [returnFeePercent, setReturnFeePercent] = useState(initialValues.returnFeePercent);
  const [isActive, setIsActive] = useState(initialValues.isActive);

  const isEditMode = mode === "edit";
  const title = isEditMode ? "Edit Township" : "Create Township";
  const submitLabel = isEditMode ? "Save Changes" : "Create Township";

  function clearBanner() {
    if (submissionState) {
      setSubmissionState(null);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionState(null);

    startTransition(async () => {
      const payload = {
        name,
        baseFee,
        baseWeightKg,
        extraWeightFee,
        extraWeightUnitKg,
        volumetricDivisor,
        codFeePercent,
        returnFeePercent,
        isActive,
      };

      const result = isEditMode
        ? await updateTownshipAction({
            id: township?.id,
            ...payload,
          })
        : await createTownshipAction(payload);

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });

        return;
      }

      setSubmissionState({
        kind: "success",
        message: `${result.township.name} pricing is ready to save.`,
        detail: "This mock flow validates township pricing without persistence yet.",
      });
    });
  }

  return (
    <form className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]" onSubmit={handleSubmit}>
      <SheetHeader className="space-y-3 border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">{title}</SheetTitle>
        <SheetDescription className="max-w-lg text-sm leading-6 text-[#73706d]">
          Configure township pricing used to auto-fill parcel delivery fees and related pricing
          defaults.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <div className="space-y-5">
          {submissionState ? <FormBanner state={submissionState} /> : null}

          <Card className="border-[#e7dfd8] bg-white shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
            <CardContent className="space-y-5">
              <FieldShell htmlFor={nameId} label="Township name">
                <Input
                  id={nameId}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearBanner();
                  }}
                  placeholder="Enter township name"
                  className={inputClassName}
                  disabled={isPending}
                />
              </FieldShell>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell htmlFor={baseFeeId} label="Base fee">
                  <MoneyInput
                    id={baseFeeId}
                    value={baseFee}
                    onChange={(value) => {
                      setBaseFee(value);
                      clearBanner();
                    }}
                    disabled={isPending}
                  />
                </FieldShell>

                <FieldShell htmlFor={baseWeightKgId} label="Base weight">
                  <NumberInput
                    id={baseWeightKgId}
                    value={baseWeightKg}
                    onChange={(value) => {
                      setBaseWeightKg(value);
                      clearBanner();
                    }}
                    suffix="kg"
                    inputMode="decimal"
                    disabled={isPending}
                  />
                </FieldShell>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell htmlFor={extraWeightFeeId} label="Extra weight fee">
                  <MoneyInput
                    id={extraWeightFeeId}
                    value={extraWeightFee}
                    onChange={(value) => {
                      setExtraWeightFee(value);
                      clearBanner();
                    }}
                    disabled={isPending}
                  />
                </FieldShell>

                <FieldShell htmlFor={extraWeightUnitKgId} label="Extra weight unit">
                  <NumberInput
                    id={extraWeightUnitKgId}
                    value={extraWeightUnitKg}
                    onChange={(value) => {
                      setExtraWeightUnitKg(value);
                      clearBanner();
                    }}
                    suffix="kg"
                    inputMode="decimal"
                    disabled={isPending}
                  />
                </FieldShell>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell htmlFor={volumetricDivisorId} label="Volumetric divisor">
                  <NumberInput
                    id={volumetricDivisorId}
                    value={volumetricDivisor}
                    onChange={(value) => {
                      setVolumetricDivisor(value);
                      clearBanner();
                    }}
                    inputMode="numeric"
                    disabled={isPending}
                  />
                </FieldShell>

                <FieldShell htmlFor={codFeePercentId} label="COD fee percent">
                  <NumberInput
                    id={codFeePercentId}
                    value={codFeePercent}
                    onChange={(value) => {
                      setCodFeePercent(value);
                      clearBanner();
                    }}
                    suffix="%"
                    inputMode="decimal"
                    disabled={isPending}
                  />
                </FieldShell>
              </div>

              <FieldShell htmlFor={returnFeePercentId} label="Return fee percent">
                <NumberInput
                  id={returnFeePercentId}
                  value={returnFeePercent}
                  onChange={(value) => {
                    setReturnFeePercent(value);
                    clearBanner();
                  }}
                  suffix="%"
                  inputMode="decimal"
                  disabled={isPending}
                />
              </FieldShell>

              <div className="grid gap-4 rounded-lg border border-dashed border-[#dcd4cd] bg-[#fcfbf8] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="space-y-1">
                  <Label
                    htmlFor="township-active-switch"
                    className="text-sm font-medium text-[#292827]"
                  >
                    Active
                  </Label>
                  <p className="text-sm text-[#5f5b58]">
                    Inactive townships stay visible in management but should not be used for new
                    parcel pricing.
                  </p>
                </div>
                <Switch
                  id="township-active-switch"
                  checked={isActive}
                  onCheckedChange={(checked) => {
                    setIsActive(checked);
                    clearBanner();
                  }}
                  disabled={isPending}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SheetFooter className="mt-0 justify-end border-t border-[#e7dfd8] bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            className="bg-[#1b1938] text-white hover:bg-[#0e0c1f]"
            disabled={isPending}
          >
            {isPending ? (isEditMode ? "Saving..." : "Creating...") : submitLabel}
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}
