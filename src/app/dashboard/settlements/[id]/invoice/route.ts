import { NextResponse } from "next/server";
import { getMerchantSettlementAccess } from "@/features/auth/server/policies/merchant-settlements";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { getMerchantSettlementDetailForViewer } from "@/features/merchant-settlements/server/dal";
import { renderMerchantSettlementInvoicePdf } from "@/features/merchant-settlements/server/invoice-pdf";
import { buildSettlementInvoiceFileName } from "@/features/merchant-settlements/server/utils";

type SettlementInvoiceRouteProps = {
    params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

function invoiceNotFound(reason: string, settlementId: string) {
    if (process.env.NODE_ENV !== "production") {
        console.warn("[merchant-settlement-invoice] returning 404", {
            reason,
            settlementId,
        });
    }

    return new NextResponse("Not found", { status: 404 });
}

export async function GET(_request: Request, { params }: SettlementInvoiceRouteProps) {
    const { id } = await params;
    let currentUser: Awaited<ReturnType<typeof requireAppAccessContext>>;

    try {
        currentUser = await requireAppAccessContext();
    } catch {
        return invoiceNotFound("unauthorized", id);
    }

    if (!getMerchantSettlementAccess(currentUser).canView) {
        return invoiceNotFound("forbidden", id);
    }

    const settlement = await getMerchantSettlementDetailForViewer(currentUser, id, {
        signPaymentSlips: false,
    });

    if (!settlement) {
        return invoiceNotFound("settlement-not-found", id);
    }

    const pdf = await renderMerchantSettlementInvoicePdf(settlement);
    const fileName = buildSettlementInvoiceFileName({
        settlementId: settlement.id,
        referenceNo: settlement.referenceNo,
    });

    return new NextResponse(new Uint8Array(pdf), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "private, no-store",
        },
    });
}
