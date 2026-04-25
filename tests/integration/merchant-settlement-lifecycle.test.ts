import { describe, expect, it } from "vitest";
import {
    canMutateSettlement,
    canReleaseSettlement,
    getSettlementStatusAfterGeneration,
    validateSettlementSelectionRows,
} from "../../src/features/merchant-settlements/server/merchant-financial-item-utils";

describe("merchant settlement lifecycle guards", () => {
    it("rejects cross-merchant candidate selections", () => {
        expect(
            validateSettlementSelectionRows({
                expectedMerchantId: "merchant-a",
                selectedIds: ["candidate-1"],
                selectedRows: [
                    {
                        id: "candidate-1",
                        merchantId: "merchant-b",
                        readiness: "ready",
                        lifecycleState: "open",
                    },
                ],
            }),
        ).toEqual({
            ok: false,
            message: "Settlement candidates must belong to the selected merchant.",
        });
    });

    it("rejects stale or locked candidate selections", () => {
        expect(
            validateSettlementSelectionRows({
                expectedMerchantId: "merchant-a",
                selectedIds: ["candidate-1"],
                selectedRows: [
                    {
                        id: "candidate-1",
                        merchantId: "merchant-a",
                        readiness: "ready",
                        lifecycleState: "locked",
                    },
                ],
            }),
        ).toEqual({
            ok: false,
            message: "Some selected settlement candidates are no longer ready.",
        });
    });

    it("treats balanced documents as immediately paid", () => {
        expect(getSettlementStatusAfterGeneration("balanced")).toBe("paid");
        expect(getSettlementStatusAfterGeneration("remit")).toBe("pending");
    });

    it("preserves paid settlement immutability and disallows release", () => {
        expect(canReleaseSettlement("pending")).toBe(true);
        expect(canReleaseSettlement("in_progress")).toBe(true);
        expect(canReleaseSettlement("paid")).toBe(false);
        expect(canMutateSettlement("paid")).toBe(false);
    });
});
