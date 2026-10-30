import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mobileErrorResponseSchema,
  mobileParcelStatuses,
  mobileParcelTypes,
  mobileRiderParcelDetailResponseSchema,
  mobileRiderParcelPageResponseSchema,
  mobileRiderParcelTabs,
} from "@/features/mobile-api/contract";
import type { RiderParcelListPageDto } from "@/features/parcels/server/dto";
import { riderParcelTabs } from "@/features/parcels/server/dto";
import { parcelStatuses, parcelTypes } from "@/lib/domain";
import { buildParcelListItem, buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async (): Promise<unknown> => null);
const headersMock = mock(async () => new Headers());
const listRiderParcelsPageForUserMock = mock(
  async (): Promise<RiderParcelListPageDto> => buildPage(),
);
const getParcelByIdForRealtimeScopeMock = mock(
  async (): Promise<ReturnType<typeof buildParcelListItem> | null> => null,
);

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

// Bun keeps module mocks for later test files, so keep the real DAL exports.
const actualParcelsDal = await import("@/features/parcels/server/dal");

void mock.module("@/features/parcels/server/dal", () => ({
  ...actualParcelsDal,
  listRiderParcelsPageForUser: listRiderParcelsPageForUserMock,
  getParcelByIdForRealtimeScope: getParcelByIdForRealtimeScopeMock,
}));

const riderId = "8b3c5d4e-1111-4a2b-9c3d-000000000001";
const parcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000002";

function buildPage(overrides: Partial<RiderParcelListPageDto> = {}): RiderParcelListPageDto {
  return {
    parcels: [],
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
    hasAnyParcels: false,
    tabCounts: { to_deliver: 0, delivered: 0, returned: 0 },
    ...overrides,
  };
}

function signInAs(role: "rider" | "merchant" | "office_admin", isActive = true) {
  getSessionMock.mockResolvedValue(buildSessionUser({ id: riderId, role, isActive }));
}

function listRequest(query = "") {
  return new Request(`http://localhost:3000/api/mobile/v1/rider/parcels${query}`);
}

function detailContext(id: string) {
  return { params: Promise.resolve({ parcelId: id }) };
}

describe("mobile rider parcel routes", async () => {
  const { GET: getList } = await import("@/app/api/mobile/v1/rider/parcels/route");
  const { GET: getDetail } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/route");

  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue(null);
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
    listRiderParcelsPageForUserMock.mockReset();
    listRiderParcelsPageForUserMock.mockResolvedValue(buildPage());
    getParcelByIdForRealtimeScopeMock.mockReset();
    getParcelByIdForRealtimeScopeMock.mockResolvedValue(null);
  });

  describe("GET /rider/parcels", () => {
    test("returns 401 without a session, before validating the query", async () => {
      const response = await getList(listRequest("?tab=nope"));

      expect(response.status).toBe(401);
      expect(listRiderParcelsPageForUserMock).not.toHaveBeenCalled();
    });

    test.each([
      ["merchant", true],
      ["office_admin", true],
      ["rider", false],
    ] as const)("returns 403 for %s (active: %s)", async (role, isActive) => {
      signInAs(role, isActive);

      const response = await getList(listRequest());

      expect(response.status).toBe(403);
      expect(listRiderParcelsPageForUserMock).not.toHaveBeenCalled();
    });

    test.each(["?tab=nope", "?page=0", "?page=-1", "?page=abc", "?page=1.5"])(
      "returns 400 for %s",
      async (query) => {
        signInAs("rider");

        const response = await getList(listRequest(query));

        expect(response.status).toBe(400);
        expect(mobileErrorResponseSchema.safeParse(await response.json()).success).toBe(true);
        expect(listRiderParcelsPageForUserMock).not.toHaveBeenCalled();
      },
    );

    test("defaults to page 1 of the to_deliver tab, with no search or filters", async () => {
      signInAs("rider");

      const response = await getList(listRequest());

      expect(response.status).toBe(200);
      expect(listRiderParcelsPageForUserMock).toHaveBeenCalledWith(riderId, {
        tab: "to_deliver",
        page: 1,
        pageSize: 20,
        searchTerm: "",
        townshipName: null,
        statuses: [],
      });
    });

    test("passes the requested tab and page, and maps the page", async () => {
      signInAs("rider");
      listRiderParcelsPageForUserMock.mockResolvedValue(
        buildPage({
          parcels: [
            buildParcelListItem({
              id: parcelId,
              parcelCode: "PF-000123-000045",
              status: "delivered",
              receiverName: "Daw Mya",
              receiverPhoneNumber: "09400000000",
              receiverAddress: "No. 12, Bogyoke Road",
              townshipName: "Sanchaung",
              codAmount: 25_000,
              deliveryFee: 3_000,
              proofOfDeliveryImagesKeys: ["proof/secret.jpg"],
              riderName: "Ko Aung",
            }),
          ],
          page: 2,
          totalPages: 3,
          totalCount: 41,
          tabCounts: { to_deliver: 5, delivered: 41, returned: 2 },
        }),
      );

      const response = await getList(listRequest("?tab=delivered&page=2"));
      const body = mobileRiderParcelPageResponseSchema.parse(await response.json());

      expect(listRiderParcelsPageForUserMock).toHaveBeenCalledWith(
        riderId,
        expect.objectContaining({ tab: "delivered", page: 2 }),
      );
      expect(body.data).toEqual({
        parcels: [
          {
            id: parcelId,
            parcelCode: "PF-000123-000045",
            status: "delivered",
            statusLabel: "Delivered",
            receiverName: "Daw Mya",
            receiverPhoneNumber: "09400000000",
            receiverAddress: "No. 12, Bogyoke Road",
            townshipName: "Sanchaung",
            amountToCollect: 28_000,
            hasActiveFailureNote: false,
          },
        ],
        page: 2,
        totalPages: 3,
        totalCount: 41,
        tabCounts: { to_deliver: 5, delivered: 41, returned: 2 },
      });
      expect(JSON.stringify(body)).not.toContain("proof/secret.jpg");
      expect(JSON.stringify(body)).not.toContain("Ko Aung");
    });

    test("converts the DAL's string counts (postgres bigint) to numbers", async () => {
      signInAs("rider");
      // What postgres-js really returns for count(*), despite the DAL's types.
      const databaseCounts = JSON.parse(
        '{"totalCount":"41","tabCounts":{"to_deliver":"5","delivered":"41","returned":"0"}}',
      );
      listRiderParcelsPageForUserMock.mockResolvedValue(buildPage(databaseCounts));

      const response = await getList(listRequest());
      const body = mobileRiderParcelPageResponseSchema.parse(await response.json());

      expect(body.data.totalCount).toBe(41);
      expect(body.data.tabCounts).toEqual({ to_deliver: 5, delivered: 41, returned: 0 });
    });

    test("returns a generic 500 when the DAL fails", async () => {
      signInAs("rider");
      listRiderParcelsPageForUserMock.mockRejectedValue(new Error("connection details"));

      const response = await getList(listRequest());

      expect(response.status).toBe(500);
      expect((await response.json()).message).toBe("Unable to load your parcels.");
    });
  });

  describe("GET /rider/parcels/[parcelId]", () => {
    test("returns 401 without a session", async () => {
      const response = await getDetail(new Request("http://localhost"), detailContext(parcelId));

      expect(response.status).toBe(401);
    });

    test("returns 400 for a non-UUID id", async () => {
      signInAs("rider");

      const response = await getDetail(new Request("http://localhost"), detailContext("abc"));

      expect(response.status).toBe(400);
      expect(getParcelByIdForRealtimeScopeMock).not.toHaveBeenCalled();
    });

    test("returns 404 when the parcel isn't assigned to the rider", async () => {
      signInAs("rider");

      const response = await getDetail(new Request("http://localhost"), detailContext(parcelId));

      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe("Parcel not found.");
      expect(getParcelByIdForRealtimeScopeMock).toHaveBeenCalledWith(parcelId, {
        role: "rider",
        userId: riderId,
      });
    });

    test("returns the parcel detail", async () => {
      signInAs("rider");
      getParcelByIdForRealtimeScopeMock.mockResolvedValue(
        buildParcelListItem({
          id: parcelId,
          status: "on_the_way",
          merchantName: "Golden Leaf Tea",
          parcelType: "cod",
          codAmount: 15_000,
          deliveryFee: 2_500,
          weightKg: 1.5,
          specialNotes: "Call before arriving",
          failureNotes: [{ note: "Receiver not home", status: "active" }],
          createdAt: "2026-10-29T08:00:00.000Z",
        }),
      );

      const response = await getDetail(new Request("http://localhost"), detailContext(parcelId));
      const body = mobileRiderParcelDetailResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        id: parcelId,
        status: "on_the_way",
        statusLabel: "On The Way",
        merchantName: "Golden Leaf Tea",
        parcelType: "cod",
        codAmount: 15_000,
        deliveryFee: 2_500,
        amountToCollect: 17_500,
        weightKg: 1.5,
        specialNotes: "Call before arriving",
        hasActiveFailureNote: true,
        activeFailureNote: "Receiver not home",
        createdAt: "2026-10-29T08:00:00.000Z",
      });
    });
  });
});

describe("mobile contract enums", () => {
  test("match the server's domain lists", () => {
    expect([...mobileParcelStatuses].toSorted()).toEqual([...parcelStatuses].toSorted());
    expect([...mobileParcelTypes].toSorted()).toEqual([...parcelTypes].toSorted());
    expect([...mobileRiderParcelTabs].toSorted()).toEqual([...riderParcelTabs].toSorted());
  });
});
