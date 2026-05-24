import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async () => buildSessionUser({ role: "super_admin" }));
const headersMock = mock(async () => new Headers());
const createMerchantSettlementMock = mock(async () => ({
  id: "settlement-id",
  settlementCode: "MS-20260524-000001",
}));
const confirmRiderCashHandoverMock = mock(async () => ({
  confirmedParcelCount: 2,
  createdCodRemitCount: 1,
}));
const resolveMerchantSettlementMock = mock(async () => undefined);
const uploadSettlementReceiptMock = mock(async () => "settlements/test/receipt.pdf");
const revalidatePathMock = mock(() => undefined);

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: headersMock,
}));

void mock.module("@/features/settlements/server/dal", () => ({
  createMerchantSettlement: createMerchantSettlementMock,
  confirmRiderCashHandover: confirmRiderCashHandoverMock,
  resolveMerchantSettlement: resolveMerchantSettlementMock,
}));

void mock.module("@/features/settlements/server/upload", () => ({
  uploadSettlementReceipt: uploadSettlementReceiptMock,
}));

void mock.module("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("settlement server actions", async () => {
  const { confirmRiderCashHandoverAction } = await import("@/features/settlements/server/actions");

  beforeEach(() => {
    getSessionMock.mockReset();
    headersMock.mockReset();
    createMerchantSettlementMock.mockReset();
    confirmRiderCashHandoverMock.mockReset();
    resolveMerchantSettlementMock.mockReset();
    uploadSettlementReceiptMock.mockReset();
    revalidatePathMock.mockReset();

    getSessionMock.mockResolvedValue(buildSessionUser({ id: "actor-id", role: "super_admin" }));
    headersMock.mockResolvedValue(new Headers());
    createMerchantSettlementMock.mockResolvedValue({
      id: "settlement-id",
      settlementCode: "MS-20260524-000001",
    });
    confirmRiderCashHandoverMock.mockResolvedValue({
      confirmedParcelCount: 2,
      createdCodRemitCount: 1,
    });
    resolveMerchantSettlementMock.mockResolvedValue(undefined);
    uploadSettlementReceiptMock.mockResolvedValue("settlements/test/receipt.pdf");
  });

  test("rejects invalid rider handover input before persistence", async () => {
    const result = await confirmRiderCashHandoverAction({
      riderId: "",
      parcelIds: [],
    });

    expect(result.ok).toBe(false);
    expect(confirmRiderCashHandoverMock).not.toHaveBeenCalled();
  });

  test("rejects rider handover confirmation from non-admin users", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "merchant" }));

    const result = await confirmRiderCashHandoverAction({
      riderId: "00000000-0000-4000-8000-000000000010",
      parcelIds: ["00000000-0000-4000-8000-000000000011"],
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to confirm rider cash handover.",
    });
    expect(confirmRiderCashHandoverMock).not.toHaveBeenCalled();
  });

  test("confirms rider handover with the acting admin and revalidates settlement views", async () => {
    const result = await confirmRiderCashHandoverAction({
      riderId: "00000000-0000-4000-8000-000000000010",
      parcelIds: [
        "00000000-0000-4000-8000-000000000011",
        "00000000-0000-4000-8000-000000000012",
      ],
    });

    expect(result).toEqual({
      ok: true,
      message: "Rider cash handover confirmed.",
      result: {
        confirmedParcelCount: 2,
        createdCodRemitCount: 1,
      },
    });
    expect(confirmRiderCashHandoverMock).toHaveBeenCalledWith({
      riderId: "00000000-0000-4000-8000-000000000010",
      parcelIds: [
        "00000000-0000-4000-8000-000000000011",
        "00000000-0000-4000-8000-000000000012",
      ],
      confirmedBy: "actor-id",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/settlements");
  });
});
