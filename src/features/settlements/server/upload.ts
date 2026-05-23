import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requireR2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Cloudflare R2 is not configured for settlement receipt uploads.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
  };
}

function getReceiptFileExtension(file: File) {
  if (file.type === "application/pdf") {
    return "pdf";
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function createR2Client(config: ReturnType<typeof requireR2Config>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function uploadSettlementReceipt(input: { settlementId: string; file: File }) {
  const config = requireR2Config();
  const objectKey = `settlements/${input.settlementId}/bank-transfer-receipts/${crypto.randomUUID()}.${getReceiptFileExtension(input.file)}`;
  const body = Buffer.from(await input.file.arrayBuffer());
  const client = createR2Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: body,
      ContentType: input.file.type,
    }),
  );

  return objectKey;
}
