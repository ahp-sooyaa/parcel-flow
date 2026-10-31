import { mobileMeResponseSchema, mobileStartDeliveryResponseSchema } from "@parcel-flow/contract";

import { apiGet, apiPost, MobileApiError, NETWORK_ERROR_MESSAGE } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { authClient } from "@/auth/client";

jest.mock("@/auth/client", () => ({
  authClient: {
    getCookie: jest.fn(() => "better-auth.session_token=abc"),
    signOut: jest.fn(async () => ({ data: { success: true }, error: null })),
  },
}));

const me = {
  id: "rider-1",
  name: "Ko Aung",
  username: "ko-aung",
  phoneNumber: "09111111111",
  role: "rider",
  mustResetPassword: false,
};

function mockFetchResponse(status: number, body: unknown) {
  return jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected the request to fail.");
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(authClient.signOut).mockClear();
});

describe("apiGet", () => {
  it("sends the session cookie and returns the response data", async () => {
    const fetchMock = mockFetchResponse(200, { ok: true, message: "Profile loaded.", data: me });

    await expect(apiGet("/me", mobileMeResponseSchema)).resolves.toEqual(me);

    expect(fetchMock).toHaveBeenCalledWith("http://parcel-flow.test/api/mobile/v1/me", {
      credentials: "omit",
      headers: { Accept: "application/json", Cookie: "better-auth.session_token=abc" },
    });
  });

  it("maps an error envelope to MobileApiError", async () => {
    mockFetchResponse(403, {
      ok: false,
      message: "The mobile app is only available to riders.",
    });

    const error = await captureError(apiGet("/me", mobileMeResponseSchema));

    expect(error).toBeInstanceOf(MobileApiError);
    expect(error).toMatchObject({
      status: 403,
      message: "The mobile app is only available to riders.",
    });
    expect(authClient.signOut).not.toHaveBeenCalled();
  });

  it("signs the rider out and clears cached data on 401", async () => {
    mockFetchResponse(401, { ok: false, message: "Authentication required." });
    queryClient.setQueryData(["me"], me);

    const error = await captureError(apiGet("/me", mobileMeResponseSchema));

    expect(error).toMatchObject({ status: 401, message: "Authentication required." });
    expect(authClient.signOut).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
  });

  it("reports network failures with status 0", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network request failed"));

    await expect(apiGet("/me", mobileMeResponseSchema)).rejects.toMatchObject({
      status: 0,
      message: NETWORK_ERROR_MESSAGE,
    });
  });

  it("rejects a success response that doesn't match the contract", async () => {
    mockFetchResponse(200, { ok: true, message: "Profile loaded.", data: { id: "rider-1" } });

    await expect(apiGet("/me", mobileMeResponseSchema)).rejects.toMatchObject({
      status: 200,
      message: "Unexpected response from Parcel Flow. Try again.",
    });
  });
});

describe("apiPost", () => {
  it("sends the body as JSON with the session cookie and returns the data", async () => {
    const fetchMock = mockFetchResponse(200, {
      ok: true,
      message: "Parcel moved to on the way.",
      data: { parcelIds: ["p1"] },
    });

    await expect(
      apiPost(
        "/rider/parcels/start-delivery",
        { parcelIds: ["p1"] },
        mobileStartDeliveryResponseSchema,
      ),
    ).resolves.toEqual({ parcelIds: ["p1"] });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://parcel-flow.test/api/mobile/v1/rider/parcels/start-delivery",
      {
        method: "POST",
        body: JSON.stringify({ parcelIds: ["p1"] }),
        credentials: "omit",
        headers: {
          Accept: "application/json",
          Cookie: "better-auth.session_token=abc",
          "Content-Type": "application/json",
        },
      },
    );
  });

  it("maps an error envelope to MobileApiError", async () => {
    mockFetchResponse(409, {
      ok: false,
      message: "Only assigned at-office parcels can be started.",
    });

    const error = await captureError(
      apiPost(
        "/rider/parcels/start-delivery",
        { parcelIds: ["p1"] },
        mobileStartDeliveryResponseSchema,
      ),
    );

    expect(error).toBeInstanceOf(MobileApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "Only assigned at-office parcels can be started.",
    });
  });

  it("signs the rider out on 401", async () => {
    mockFetchResponse(401, { ok: false, message: "Authentication required." });

    await captureError(
      apiPost(
        "/rider/parcels/start-delivery",
        { parcelIds: ["p1"] },
        mobileStartDeliveryResponseSchema,
      ),
    );

    expect(authClient.signOut).toHaveBeenCalled();
  });
});
