import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildSessionUser } from "../fixtures/builders";

const actorId = "00000000-0000-4000-8000-000000000001";
const riderId = "00000000-0000-4000-8000-000000000002";
const itemId = "00000000-0000-4000-8000-000000000003";
const payoutId = "00000000-0000-4000-8000-000000000004";
const getSessionMock = mock(async () => buildSessionUser({ id: actorId, role: "super_admin" }));
const headersMock = mock(async () => new Headers());
const createRiderPayoutDraftMock = mock(async () => ({
  id: payoutId,
  payoutCode: "RP-20260615-000001",
}));
const settleRiderPayoutMock = mock(async () => undefined);
const cancelRiderPayoutDraftMock = mock(async () => undefined);
const listEligibleRiderPayoutRiderSummariesMock = mock(async () => []);
const getEligibleRiderPayoutItemsByRiderIdMock = mock(async () => []);
const revalidatePathMock = mock(() => undefined);
const updateTagMock = mock(() => undefined);
const revalidateTagMock = mock(() => undefined);

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

void mock.module("@/features/rider-payouts/server/dal", () => ({
  createRiderPayoutDraft: createRiderPayoutDraftMock,
  settleRiderPayout: settleRiderPayoutMock,
  cancelRiderPayoutDraft: cancelRiderPayoutDraftMock,
  listEligibleRiderPayoutRiderSummaries: listEligibleRiderPayoutRiderSummariesMock,
  getEligibleRiderPayoutItemsByRiderId: getEligibleRiderPayoutItemsByRiderIdMock,
}));

void mock.module("next/cache", () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
  revalidatePath: revalidatePathMock,
  updateTag: updateTagMock,
  revalidateTag: revalidateTagMock,
}));

describe("rider payout server actions", async () => {
  const { cancelRiderPayoutDraftAction, createRiderPayoutDraftAction, settleRiderPayoutAction } =
    await import("@/features/rider-payouts/server/actions");

  beforeEach(() => {
    getSessionMock.mockReset();
    headersMock.mockReset();
    createRiderPayoutDraftMock.mockReset();
    settleRiderPayoutMock.mockReset();
    cancelRiderPayoutDraftMock.mockReset();
    revalidatePathMock.mockReset();
    updateTagMock.mockReset();
    revalidateTagMock.mockReset();

    getSessionMock.mockResolvedValue(buildSessionUser({ id: actorId, role: "super_admin" }));
    headersMock.mockResolvedValue(new Headers());
    createRiderPayoutDraftMock.mockResolvedValue({
      id: payoutId,
      payoutCode: "RP-20260615-000001",
    });
    settleRiderPayoutMock.mockResolvedValue(undefined);
    cancelRiderPayoutDraftMock.mockResolvedValue(undefined);
  });

  test("returns field errors for invalid payout draft input", async () => {
    const result = await createRiderPayoutDraftAction({
      riderId: "",
      financialItemIds: [],
      feePerWay: 0,
    });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("fieldErrors");
    expect(createRiderPayoutDraftMock).not.toHaveBeenCalled();
  });

  test("rejects payout creation from non-admin users", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "rider" }));

    const result = await createRiderPayoutDraftAction({
      riderId,
      financialItemIds: [itemId],
      feePerWay: 900,
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to create rider payout drafts.",
    });
    expect(createRiderPayoutDraftMock).not.toHaveBeenCalled();
  });

  test("creates a payout draft with the acting admin", async () => {
    const result = await createRiderPayoutDraftAction({
      riderId,
      financialItemIds: [itemId],
      feePerWay: 900,
    });

    expect(result.ok).toBe(true);
    expect(createRiderPayoutDraftMock).toHaveBeenCalledWith({
      riderId,
      financialItemIds: [itemId],
      feePerWay: 900,
      createdBy: actorId,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider-payouts");
  });

  test("allows office admins to cancel but not settle payout drafts", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ id: actorId, role: "office_admin" }));

    const settleResult = await settleRiderPayoutAction({ payoutId });
    const cancelResult = await cancelRiderPayoutDraftAction({ payoutId });

    expect(settleResult).toEqual({
      ok: false,
      message: "You do not have permission to settle rider payouts.",
    });
    expect(settleRiderPayoutMock).not.toHaveBeenCalled();
    expect(cancelResult.ok).toBe(true);
    expect(cancelRiderPayoutDraftMock).toHaveBeenCalledWith({ payoutId });
  });

  test("settles payout with paid metadata for super admins", async () => {
    const result = await settleRiderPayoutAction({
      payoutId,
      paymentNote: "Transfer complete.",
    });

    expect(result.ok).toBe(true);
    expect(settleRiderPayoutMock).toHaveBeenCalledWith({
      payoutId,
      paymentNote: "Transfer complete.",
      paidBy: actorId,
    });
  });
});
