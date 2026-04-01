import { beforeEach, describe, expect, it, vi } from "vitest";

const selectMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
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
    leftJoinMock.mockReset();
    whereMock.mockReset();
    orderByMock.mockReset();
    limitMock.mockReset();

    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ leftJoin: leftJoinMock });
    leftJoinMock.mockReturnValue({ where: whereMock });
    whereMock.mockReturnValue({ orderBy: orderByMock });
    orderByMock.mockReturnValue({ limit: limitMock });
  });

  it("queries merchants with deterministic ordering and maps rows", async () => {
    limitMock.mockResolvedValue([
      {
        id: "m-1",
        name: "Alpha",
        phoneNumber: "09420000000",
        township: "Bahan",
        address: "No 1",
        linkedAppUserId: null,
        linkedAppUserName: null,
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
        name: "Alpha",
        phoneNumber: "09420000000",
        township: "Bahan",
        address: "No 1",
        linkedAppUserId: null,
        linkedAppUserName: null,
        createdAt: new Date("2026-03-31T00:00:00.000Z"),
      },
    ]);
  });

  it("returns merchant detail only for merchant self-scope", async () => {
    limitMock.mockResolvedValue([]);

    const { getMerchantByIdForViewer } = await import("@/features/merchant/server/dal");

    const result = await getMerchantByIdForViewer({
      merchantId: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
      viewerRoleSlug: "merchant",
      viewerAppUserId: "app-user-1",
    });

    expect(result).toBeNull();
    expect(whereMock).toHaveBeenCalled();
  });

  it("returns null before querying when merchant id is malformed", async () => {
    const { getMerchantByIdForViewer } = await import("@/features/merchant/server/dal");

    const result = await getMerchantByIdForViewer({
      merchantId: "not-a-uuid",
      viewerRoleSlug: "office_admin",
      viewerAppUserId: "app-user-1",
    });

    expect(result).toBeNull();
    expect(whereMock).not.toHaveBeenCalled();
  });
});
