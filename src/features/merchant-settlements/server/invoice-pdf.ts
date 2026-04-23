import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";

import type { MerchantSettlementDetailDto } from "@/features/merchant-settlements/server/dto";

const invoiceRegularFontPath = join(process.cwd(), "public/fonts/Padauk-Regular.ttf");
const invoiceBoldFontPath = join(process.cwd(), "public/fonts/Padauk-Bold.ttf");

type InvoiceFonts = {
    regular: string;
    bold: string;
};
const moneyFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Yangon",
    year: "numeric",
});

function formatMmk(value: string) {
    const amount = Number(value);

    return `${moneyFormatter.format(Number.isFinite(amount) ? amount : 0)} MMK`;
}

function formatDate(value: Date) {
    return dateFormatter.format(value);
}

function assertInvoiceFontExists(path: string) {
    if (!existsSync(path)) {
        throw new Error(`Invoice font is missing: ${path}`);
    }
}

function createInvoiceDocument() {
    assertInvoiceFontExists(invoiceRegularFontPath);

    return new PDFDocument({
        font: invoiceRegularFontPath,
        margin: 40,
        size: "A4",
    });
}

function registerInvoiceFonts(doc: PDFKit.PDFDocument): InvoiceFonts {
    const boldPath = existsSync(invoiceBoldFontPath) ? invoiceBoldFontPath : invoiceRegularFontPath;

    doc.registerFont("InvoiceRegular", invoiceRegularFontPath);
    doc.registerFont("InvoiceBold", boldPath);

    return { regular: "InvoiceRegular", bold: "InvoiceBold" };
}

function fitText(value: string | null | undefined, maxLength: number) {
    const text = value || "-";

    return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function writeKeyValue(
    doc: PDFKit.PDFDocument,
    fonts: InvoiceFonts,
    label: string,
    value: string,
    x: number,
    y: number,
) {
    doc.font(fonts.bold).fontSize(8).text(label, x, y);
    doc.font(fonts.regular)
        .fontSize(9)
        .text(value, x, y + 12, {
            width: 245,
        });
}

function writeTableHeader(doc: PDFKit.PDFDocument, fonts: InvoiceFonts, y: number) {
    doc.font(fonts.bold).fontSize(8);
    doc.text("#", 40, y, { width: 24 });
    doc.text("Parcel", 64, y, { width: 78 });
    doc.text("Recipient", 142, y, { width: 98 });
    doc.text("Township", 240, y, { width: 70 });
    doc.text("COD", 310, y, { width: 72, align: "right" });
    doc.text("Fee Deducted", 382, y, { width: 78, align: "right" });
    doc.text("Net Payable", 460, y, { width: 95, align: "right" });
    doc.moveTo(40, y + 14)
        .lineTo(555, y + 14)
        .strokeColor("#dddddd")
        .stroke();
}

function writeTotals(
    doc: PDFKit.PDFDocument,
    fonts: InvoiceFonts,
    settlement: MerchantSettlementDetailDto,
    y: number,
) {
    const rows = [
        ["COD subtotal", formatMmk(settlement.totals.codSubtotal)],
        ["Delivery fee deducted", `-${formatMmk(settlement.totals.deliveryFeeDeductedTotal)}`],
        ["Net payable", formatMmk(settlement.totals.netPayableTotal)],
    ] as const;

    let currentY = y;
    for (const [label, value] of rows) {
        doc.font(label === "Net payable" ? fonts.bold : fonts.regular)
            .fontSize(label === "Net payable" ? 11 : 9)
            .text(label, 335, currentY, { width: 100 });
        doc.font(label === "Net payable" ? fonts.bold : fonts.regular)
            .fontSize(label === "Net payable" ? 11 : 9)
            .text(value, 435, currentY, { width: 120, align: "right" });
        currentY += 18;
    }
}

export async function renderMerchantSettlementInvoicePdf(
    settlement: MerchantSettlementDetailDto,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = createInvoiceDocument();
        const chunks: Buffer[] = [];

        const fonts = registerInvoiceFonts(doc);

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.font(fonts.bold).fontSize(18).text("Merchant Settlement Invoice", 40, 40);
        doc.font(fonts.regular).fontSize(9).text(`Settlement ${settlement.id}`, 40, 66);
        doc.font(fonts.bold)
            .fontSize(14)
            .text(formatMmk(settlement.totals.netPayableTotal), 375, 40, {
                align: "right",
                width: 180,
            });
        doc.font(fonts.regular).fontSize(9).text(settlement.status, 375, 60, {
            align: "right",
            width: 180,
        });

        writeKeyValue(doc, fonts, "Merchant", settlement.merchantLabel, 40, 96);
        writeKeyValue(doc, fonts, "Reference", settlement.referenceNo ?? "-", 310, 96);
        writeKeyValue(doc, fonts, "Bank", settlement.snapshotBankName, 40, 140);
        writeKeyValue(doc, fonts, "Bank Account", settlement.snapshotBankAccountNumber, 310, 140);
        writeKeyValue(doc, fonts, "Created By", settlement.createdByName, 40, 184);
        writeKeyValue(doc, fonts, "Confirmed By", settlement.confirmedByName ?? "-", 310, 184);
        writeKeyValue(doc, fonts, "Created", formatDate(settlement.createdAt), 40, 228);
        writeKeyValue(doc, fonts, "Updated", formatDate(settlement.updatedAt), 310, 228);
        writeKeyValue(
            doc,
            fonts,
            "Payment Proof",
            settlement.paymentSlipImageCount > 0 ? "Uploaded" : "Not uploaded",
            40,
            272,
        );

        let y = 326;
        writeTableHeader(doc, fonts, y);
        y += 22;
        doc.font(fonts.regular).fontSize(8).strokeColor("#eeeeee");

        settlement.items.forEach((item, index) => {
            if (y > 730) {
                doc.addPage();
                y = 50;
                writeTableHeader(doc, fonts, y);
                y += 22;
                doc.font(fonts.regular).fontSize(8).strokeColor("#eeeeee");
            }

            const feeDeducted = item.isDeliveryFeeDeducted
                ? `-${formatMmk(item.snapshotDeliveryFee)}`
                : formatMmk("0");

            doc.text(String(index + 1), 40, y, { width: 24 });
            doc.text(fitText(item.parcelCode, 16), 64, y, { width: 78 });
            doc.text(fitText(item.recipientName, 22), 142, y, { width: 98 });
            doc.text(fitText(item.recipientTownshipName, 16), 240, y, { width: 70 });
            doc.text(formatMmk(item.snapshotCodAmount), 310, y, { width: 72, align: "right" });
            doc.text(feeDeducted, 382, y, { width: 78, align: "right" });
            doc.text(formatMmk(item.netPayableAmount), 460, y, { width: 95, align: "right" });
            doc.moveTo(40, y + 14)
                .lineTo(555, y + 14)
                .stroke();
            y += 20;
        });

        if (y > 700) {
            doc.addPage();
            y = 50;
        }

        writeTotals(doc, fonts, settlement, y + 18);
        doc.end();
    });
}
