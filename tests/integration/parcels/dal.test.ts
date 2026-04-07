import { beforeEach, describe, expect, it, vi } from "vitest";

const selectMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const innerJoinMock = vi.hoisted(() => vi.fn());
const leftJoinMock = vi.hoisted(() => vi.fn());
const whereMock = vi.hoisted(() => vi.fn());
const orderByMock = vi.hoisted(() => vi.fn());
const limitMock = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  db: {
    select: selectMock,
    transaction: vi.fn(),
  },
}));

const adminViewer = {
  role: {
    id: "role-1",
    slug: "office_admin" as const,
    label: "Office Admin",
  },
  linkedMerchantId: null,
  linkedRiderId: null,
};

const merchantViewer = {
  role: {
    id: "role-2",
    slug: "merchant" as const,
    label: "Merchant",
  },
  linkedMerchantId: "merchant-1",
  linkedRiderId: null,
};

const riderViewer = {
  role: {
    id: "role-3",
    slug: "rider" as const,
    label: "Rider",
  },
  linkedMerchantId: null,
  linkedRiderId: "rider-1",
};

describe("parcels dal integration", () => {
  beforeEach(() => {
    selectMock.mockReset();
    fromMock.mockReset();
    innerJoinMock.mockReset();
    leftJoinMock.mockReset();
    whereMock.mockReset();
    orderByMock.mockReset();
    limitMock.mockReset();

    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ innerJoin: innerJoinMock, leftJoin: leftJoinMock });
    innerJoinMock.mockReturnValue({ leftJoin: leftJoinMock });
    leftJoinMock.mockReturnValue({
      leftJoin: leftJoinMock,
      where: whereMock,
      orderBy: orderByMock,
    });
    whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock });
    orderByMock.mockReturnValue({ limit: limitMock });
  });

  it("returns parcel list mapped with status defaults", async () => {
    orderByMock.mockResolvedValue([
      {
        id: "parcel-1",
        parcelCode: "PF-001",
        merchantLabel: "Alpha Shop",
        recipientName: "Ko Aung",
        recipientTownshipName: "Bahan",
        parcelStatus: "pending",
        deliveryFeeStatus: null,
        collectionStatus: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);

    const { getParcelsList } = await import("@/features/parcels/server/dal");

    const rows = await getParcelsList(adminViewer);

    expect(orderByMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      {
        id: "parcel-1",
        parcelCode: "PF-001",
        merchantLabel: "Alpha Shop",
        recipientName: "Ko Aung",
        recipientTownshipName: "Bahan",
        parcelStatus: "pending",
        deliveryFeeStatus: "unpaid",
        collectionStatus: "pending",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);
  });

  it("returns null when parcel detail is not found", async () => {
    limitMock.mockResolvedValue([]);

    const { getParcelById } = await import("@/features/parcels/server/dal");

    const parcel = await getParcelById("7f048ecf-7989-4f2e-b0a2-97f950f53ea4", adminViewer);

    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(parcel).toBeNull();
  });

  it("returns merchant-scoped parcel list rows", async () => {
    orderByMock.mockResolvedValue([
      {
        id: "parcel-2",
        parcelCode: "PF-002",
        merchantLabel: "Alpha Shop",
        recipientName: "Ma Hnin",
        recipientTownshipName: "Tamwe",
        parcelStatus: "out_for_delivery",
        deliveryFeeStatus: "unpaid",
        collectionStatus: "pending",
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
      },
    ]);

    const { getMerchantParcelsList } = await import("@/features/parcels/server/dal");

    const rows = await getMerchantParcelsList(merchantViewer, "merchant-1");

    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      {
        id: "parcel-2",
        parcelCode: "PF-002",
        merchantLabel: "Alpha Shop",
        recipientName: "Ma Hnin",
        recipientTownshipName: "Tamwe",
        parcelStatus: "out_for_delivery",
        deliveryFeeStatus: "unpaid",
        collectionStatus: "pending",
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
      },
    ]);
  });

  it("returns rider parcel detail with next action for assigned rider", async () => {
    limitMock.mockResolvedValue([
      {
        id: "parcel-3",
        parcelCode: "PF-003",
        merchantId: "merchant-1",
        merchantLabel: "Alpha Shop",
        riderId: "rider-1",
        riderLabel: "Rider One",
        recipientName: "Ko Min",
        recipientPhone: "091111111",
        recipientTownshipId: "township-1",
        recipientTownshipName: "Bahan",
        recipientAddress: "Street 1",
        parcelType: "cod",
        codAmount: "5000.00",
        deliveryFee: "1000.00",
        totalAmountToCollect: "6000.00",
        deliveryFeePayer: "receiver",
        parcelStatus: "pending",
        deliveryFeeStatus: "unpaid",
        codStatus: "pending",
        collectedAmount: "0",
        collectionStatus: "pending",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        paymentNote: null,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
        updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      },
    ]);

    const { getRiderParcelById } = await import("@/features/parcels/server/dal");

    const parcel = await getRiderParcelById("parcel-3", riderViewer);

    expect(parcel).toEqual({
      id: "parcel-3",
      parcelCode: "PF-003",
      merchantLabel: "Alpha Shop",
      riderLabel: "Rider One",
      recipientName: "Ko Min",
      recipientPhone: "091111111",
      recipientTownshipName: "Bahan",
      recipientAddress: "Street 1",
      parcelType: "cod",
      parcelStatus: "pending",
      codAmount: "5000.00",
      totalAmountToCollect: "6000.00",
      collectionStatus: "pending",
      nextAction: {
        label: "Start Pickup",
        nextStatus: "out_for_pickup",
      },
    });
  });
});
