import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async () => buildSessionUser({ role: "super_admin" }));
const headersMock = mock(async () => new Headers());
const createTownshipMock = mock(async (input: unknown) => ({ id: "township-id", input }));
const updateTownshipMock = mock(
  async (id: string, input: unknown): Promise<unknown> => ({
    id,
    input,
  }),
);
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

void mock.module("@/features/townships/server/dal", () => ({
  createTownship: createTownshipMock,
  updateTownship: updateTownshipMock,
}));

void mock.module("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  updateTag: updateTagMock,
  revalidateTag: revalidateTagMock,
}));

describe("township server actions", async () => {
  const { createTownshipAction, updateTownshipAction } =
    await import("@/features/townships/server/actions");

  beforeEach(() => {
    getSessionMock.mockReset();
    headersMock.mockReset();
    createTownshipMock.mockReset();
    updateTownshipMock.mockReset();
    revalidatePathMock.mockReset();
    updateTagMock.mockReset();
    revalidateTagMock.mockReset();
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "super_admin" }));
    headersMock.mockResolvedValue(new Headers());
    createTownshipMock.mockImplementation(async (input: unknown) => ({ id: "township-id", input }));
    updateTownshipMock.mockImplementation(async (id: string, input: unknown) => ({ id, input }));
  });

  test("rejects invalid township input before persistence", async () => {
    const result = await createTownshipAction({ name: "" });

    expect(result.ok).toBe(false);
    expect(createTownshipMock).not.toHaveBeenCalled();
  });

  test("rejects township writes from non-super-admin users", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "office_admin" }));

    const result = await createTownshipAction(validTownshipInput());

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to manage township pricing.",
    });
    expect(createTownshipMock).not.toHaveBeenCalled();
  });

  test("persists valid township creation and revalidates affected pages", async () => {
    const result = await createTownshipAction(validTownshipInput());

    expect(result.ok).toBe(true);
    expect(createTownshipMock).toHaveBeenCalledWith(validTownshipInput());
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/townships");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
  });

  test("returns not-found when updating a missing township", async () => {
    updateTownshipMock.mockResolvedValue(null);

    const result = await updateTownshipAction({ id: "missing-id", ...validTownshipInput() });

    expect(result).toEqual({
      ok: false,
      message: "Township was not found.",
    });
  });

  test("rejects invalid township updates before persistence", async () => {
    const result = await updateTownshipAction({ id: "", ...validTownshipInput() });

    expect(result.ok).toBe(false);
    expect(updateTownshipMock).not.toHaveBeenCalled();
  });

  test("rejects unauthorized township updates", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "office_admin" }));

    const result = await updateTownshipAction({ id: "township-id", ...validTownshipInput() });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to manage township pricing.",
    });
    expect(updateTownshipMock).not.toHaveBeenCalled();
  });

  test("updates township pricing with zero-value boundaries and revalidates pages", async () => {
    const result = await updateTownshipAction({
      id: "township-id",
      ...validTownshipInput(),
      baseFee: 0,
      extraWeightFee: 0,
      codFeePercent: 0,
      returnFeePercent: 0,
    });

    expect(result.ok).toBe(true);
    expect(updateTownshipMock).toHaveBeenCalledWith("township-id", {
      id: "township-id",
      name: "Yangon",
      baseFee: 0,
      baseWeightKg: 3,
      extraWeightFee: 0,
      extraWeightUnitKg: 1,
      volumetricDivisor: 5000,
      codFeePercent: 0,
      returnFeePercent: 0,
      isActive: true,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/townships");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
  });
});

function validTownshipInput() {
  return {
    name: "Yangon",
    baseFee: 2_000,
    baseWeightKg: 3,
    extraWeightFee: 500,
    extraWeightUnitKg: 1,
    volumetricDivisor: 5000,
    codFeePercent: 0,
    returnFeePercent: 100,
    isActive: true,
  };
}
