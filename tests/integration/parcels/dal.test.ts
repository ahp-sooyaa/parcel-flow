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
});
