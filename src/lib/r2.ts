import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { getR2Env } from "@/lib/env";

let r2Client: S3Client | null = null;

function getR2Client() {
    if (r2Client) {
        return r2Client;
    }

    const env = getR2Env();

    r2Client = new S3Client({
        region: "auto",
        endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
    });

    return r2Client;
}

function sanitizeSegment(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9.-]+/g, "-")
        .replaceAll(/^-+|-+$/g, "")
        .slice(0, 80);
}

export function buildR2ObjectKey(input: {
    scope: string;
    category: string;
    originalFileName: string;
}) {
    const extension = input.originalFileName.includes(".")
        ? (input.originalFileName.split(".").pop()?.toLowerCase() ?? "bin")
        : "bin";
    const safeScope = sanitizeSegment(input.scope) || "parcel";
    const safeCategory = sanitizeSegment(input.category) || "file";

    return `parcels/${safeScope}/${safeCategory}/${randomUUID()}.${extension}`;
}

export async function uploadR2Object(input: { key: string; file: File }) {
    const env = getR2Env();
    const body = Buffer.from(await input.file.arrayBuffer());

    await getR2Client().send(
        new PutObjectCommand({
            Bucket: env.CLOUDFLARE_R2_BUCKET,
            Key: input.key,
            Body: body,
            ContentType: input.file.type || "application/octet-stream",
            ContentLength: body.byteLength,
        }),
    );

    return input.key;
}

export async function getSignedR2ObjectUrl(key: string, expiresInSeconds = 900) {
    const env = getR2Env();

    return getSignedUrl(
        getR2Client(),
        new GetObjectCommand({
            Bucket: env.CLOUDFLARE_R2_BUCKET,
            Key: key,
        }),
        { expiresIn: expiresInSeconds },
    );
}
