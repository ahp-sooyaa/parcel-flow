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
  },
}));

describe("merchant dal integration", () => {
  beforeEach(() => {
    selectMock.mockReset();
    fromMock.mockReset();
    innerJoinMock.mockReset();
    leftJoinMock.mockReset();
    whereMock.mockReset();
    orderByMock.mockReset();
    limitMock.mockReset();

    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ innerJoin: innerJoinMock });
    innerJoinMock.mockReturnValue({ leftJoin: leftJoinMock });
    leftJoinMock.mockReturnValue({ where: whereMock });
    whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock });
    orderByMock.mockReturnValue({ limit: limitMock });
  });

  it("queries merchants with deterministic ordering and maps rows", async () => {
    limitMock.mockResolvedValue([
      {
        id: "m-1",
        shopName: "Alpha",
        contactName: "Ko Aung",
        phoneNumber: "09420000000",
        townshipName: "Bahan",
        defaultPickupAddress: "No 1",
        createdAt: new Date("2026-03-31T00:00:00.000Z"),
      },
    ]);

    const { getMerchantsList } = await import("@/features/merchant/server/dal");

    const result = await getMerchantsList({ query: "Alpha", limit: 25 });

    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(whereMock.mock.calls[0][0]).toBeDefined();
    expect(orderByMock).toHaveBeenCalledTimes(1);
    expect(orderByMock.mock.calls[0]).toHaveLength(2);
    expect(limitMock).toHaveBeenCalledWith(25);
    expect(result).toEqual([
      {
        id: "m-1",
        shopName: "Alpha",
        contactName: "Ko Aung",
        phoneNumber: "09420000000",
        townshipName: "Bahan",
        defaultPickupAddress: "No 1",
        createdAt: new Date("2026-03-31T00:00:00.000Z"),
      },
    ]);
  });

  it("returns merchant detail by id", async () => {
    limitMock.mockResolvedValue([]);

    const { getMerchantById } = await import("@/features/merchant/server/dal");

    const result = await getMerchantById("7f048ecf-7989-4f2e-b0a2-97f950f53ea4");

    expect(result).toBeNull();
    expect(whereMock).toHaveBeenCalled();
  });

  it("returns null before querying when merchant id is malformed", async () => {
    const { getMerchantById } = await import("@/features/merchant/server/dal");

    const result = await getMerchantById("not-a-uuid");

    expect(result).toBeNull();
    expect(whereMock).not.toHaveBeenCalled();
  });
});
