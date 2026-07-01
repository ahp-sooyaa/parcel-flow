import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createRiderPayoutDraftActionMock = mock(async () => ({
  ok: true as const,
  message: "Rider payout draft created.",
  payout: {
    id: "00000000-0000-4000-8000-000000000020",
    payoutCode: "RP-20260615-000001",
  },
}));
const settleRiderPayoutActionMock = mock(async () => ({
  ok: true as const,
  message: "Rider payout marked as paid.",
}));
const cancelRiderPayoutDraftActionMock = mock(async () => ({
  ok: true as const,
  message: "Rider payout draft canceled.",
}));
const listEligibleRiderPayoutRiderSummariesActionMock = mock(async () => ({
  ok: true as const,
  riders: [
    {
      riderId: "00000000-0000-4000-8000-000000000001",
      riderName: "Test Rider",
      eligibleItemCount: 2,
    },
  ],
}));
const getEligibleRiderPayoutRiderDetailActionMock = mock(async () => ({
  ok: true as const,
  financialItems: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      parcelId: "00000000-0000-4000-8000-000000000003",
      parcelCode: "PF-001",
      riderWaySource: "delivery_attempt" as const,
      status: "pending" as const,
      createdAt: "2026-06-14T00:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      parcelId: "00000000-0000-4000-8000-000000000005",
      parcelCode: "PF-002",
      riderWaySource: "merchant_return" as const,
      status: "pending" as const,
      createdAt: "2026-06-15T00:00:00.000Z",
    },
  ],
}));
const routerRefreshMock = mock(() => undefined);

void mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => "/dashboard/rider-payouts",
}));

void mock.module("@/features/rider-payouts/server/actions", () => ({
  createRiderPayoutDraftAction: createRiderPayoutDraftActionMock,
  settleRiderPayoutAction: settleRiderPayoutActionMock,
  cancelRiderPayoutDraftAction: cancelRiderPayoutDraftActionMock,
  listEligibleRiderPayoutRiderSummariesAction: listEligibleRiderPayoutRiderSummariesActionMock,
  getEligibleRiderPayoutRiderDetailAction: getEligibleRiderPayoutRiderDetailActionMock,
}));

void mock.module("@/lib/client-navigation", () => ({
  useAppRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

void mock.module("sonner", () => ({
  toast: {
    success: () => undefined,
    error: () => undefined,
  },
}));

describe("RiderPayoutWorkspace", async () => {
  const { RiderPayoutCreateAction, RiderPayoutWorkspace } =
    await import("@/features/rider-payouts/components/rider-payout-workspace");

  beforeEach(() => {
    createRiderPayoutDraftActionMock.mockReset();
    settleRiderPayoutActionMock.mockReset();
    cancelRiderPayoutDraftActionMock.mockReset();
    listEligibleRiderPayoutRiderSummariesActionMock.mockReset();
    getEligibleRiderPayoutRiderDetailActionMock.mockReset();
    routerRefreshMock.mockReset();
    createRiderPayoutDraftActionMock.mockResolvedValue({
      ok: true,
      message: "Rider payout draft created.",
      payout: {
        id: "00000000-0000-4000-8000-000000000020",
        payoutCode: "RP-20260615-000001",
      },
    });
    getEligibleRiderPayoutRiderDetailActionMock.mockResolvedValue({
      ok: true,
      financialItems: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          parcelId: "00000000-0000-4000-8000-000000000003",
          parcelCode: "PF-001",
          riderWaySource: "delivery_attempt",
          status: "pending",
          createdAt: "2026-06-14T00:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000004",
          parcelId: "00000000-0000-4000-8000-000000000005",
          parcelCode: "PF-002",
          riderWaySource: "merchant_return",
          status: "pending",
          createdAt: "2026-06-15T00:00:00.000Z",
        },
      ],
    });
    listEligibleRiderPayoutRiderSummariesActionMock.mockResolvedValue({
      ok: true,
      riders: [
        {
          riderId: "00000000-0000-4000-8000-000000000001",
          riderName: "Test Rider",
          eligibleItemCount: 2,
        },
      ],
    });
  });

  const defaultPayoutFilters = { page: 1, pageSize: 20 };

  test("renders persisted payout empty state", () => {
    render(
      <RiderPayoutWorkspace
        pageResult={{
          payouts: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 1,
        }}
        filters={defaultPayoutFilters}
        actorRole="super_admin"
      />,
    );

    expect(screen.getByText("No rider payouts.")).toBeTruthy();
  });

  test("selects eligible ways and calculates payout summary", async () => {
    const user = userEvent.setup();
    render(
      <RiderPayoutCreateAction
        initialEligibleRiderSummaries={[
          {
            riderId: "00000000-0000-4000-8000-000000000001",
            riderName: "Test Rider",
            eligibleItemCount: 2,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create Payout" }));
    await user.click(screen.getByLabelText(/Rider\s*\*/i));
    await user.click(await screen.findByRole("option", { name: "Test Rider (2 ways)" }));

    expect(await screen.findAllByText("Pending")).toHaveLength(2);
    await user.type(screen.getByLabelText(/Fee per way\s*\*/i), "900");
    expect(screen.getByText("1,800 MMK")).toBeTruthy();

    await user.click(screen.getByLabelText("Select way for PF-002"));
    expect(screen.getByText("900 MMK")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Create Draft" }));
    expect(createRiderPayoutDraftActionMock).toHaveBeenCalledWith({
      riderId: "00000000-0000-4000-8000-000000000001",
      financialItemIds: ["00000000-0000-4000-8000-000000000002"],
      feePerWay: "900",
    });
  });

  test("keeps payment settlement control super-admin only", async () => {
    const user = userEvent.setup();
    render(
      <RiderPayoutWorkspace
        actorRole="office_admin"
        filters={defaultPayoutFilters}
        pageResult={{
          payouts: [
            {
              id: "00000000-0000-4000-8000-000000000010",
              payoutCode: "RP-20260615-000001",
              riderId: "00000000-0000-4000-8000-000000000011",
              riderName: "Office Rider",
              status: "in_progress",
              deliveredWayCount: 2,
              feePerWay: 900,
              totalPayoutAmount: 1_800,
              paidAt: null,
              paymentNote: null,
              createdAt: "2026-06-15T00:00:00.000Z",
            },
          ],
          page: 1,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage" }));

    expect(screen.getByRole("button", { name: "Cancel Draft" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark as Paid" })).toBeNull();
  });
});
