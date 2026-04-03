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

describe("rider dal integration", () => {
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
    leftJoinMock.mockReturnValue({ where: whereMock, limit: limitMock });
    whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock });
    orderByMock.mockReturnValue({ limit: limitMock });
  });

  it("queries riders with township labels and operational fields", async () => {
    limitMock.mockResolvedValue([
      {
        id: "r-1",
        fullName: "Rider One",
        phoneNumber: "091234567",
        townshipName: "Bahan",
        vehicleType: "bike",
        licensePlate: "YGN-1234",
        isActive: true,
        notes: "Night shift",
        createdAt: new Date("2026-03-31T00:00:00.000Z"),
      },
    ]);

    const { getRidersList } = await import("@/features/rider/server/dal");

    const result = await getRidersList({ query: "bike", limit: 25 });

    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(orderByMock.mock.calls[0]).toHaveLength(2);
    expect(limitMock).toHaveBeenCalledWith(25);
    expect(result).toEqual([
      {
        id: "r-1",
        fullName: "Rider One",
        phoneNumber: "091234567",
        townshipName: "Bahan",
        vehicleType: "bike",
        licensePlate: "YGN-1234",
        isActive: true,
        notes: "Night shift",
        createdAt: new Date("2026-03-31T00:00:00.000Z"),
      },
    ]);
  });

  it("returns rider detail by id", async () => {
    limitMock.mockResolvedValue([
      {
        id: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
        fullName: "Rider One",
        email: "rider@example.com",
        phoneNumber: "091234567",
        townshipName: "Bahan",
        vehicleType: "bike",
        licensePlate: "YGN-1234",
        isActive: true,
        notes: "Night shift",
        createdAt: new Date("2026-03-31T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);

    const { getRiderById } = await import("@/features/rider/server/dal");

    const result = await getRiderById("7f048ecf-7989-4f2e-b0a2-97f950f53ea4");

    expect(result).toEqual({
      id: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
      fullName: "Rider One",
      email: "rider@example.com",
      phoneNumber: "091234567",
      townshipName: "Bahan",
      vehicleType: "bike",
      licensePlate: "YGN-1234",
      isActive: true,
      notes: "Night shift",
      createdAt: new Date("2026-03-31T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    });
  });

  it("returns null before querying when rider id is malformed", async () => {
    const { getRiderById } = await import("@/features/rider/server/dal");

    const result = await getRiderById("not-a-uuid");

    expect(result).toBeNull();
    expect(whereMock).not.toHaveBeenCalled();
  });
});
