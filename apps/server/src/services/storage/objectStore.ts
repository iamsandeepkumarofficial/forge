import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";

const N_404 = 404;

const client = new S3Client({
  region: process.env.OBJECT_STORE_REGION || "us-east-1",
  endpoint: process.env.OBJECT_STORE_ENDPOINT || "http://localhost:9000",
  forcePathStyle: process.env.OBJECT_STORE_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.OBJECT_STORE_ACCESS_KEY || "",
    secretAccessKey: process.env.OBJECT_STORE_SECRET_KEY || ""
  }
});
export async function getObject(
  bucket: string,
  key: string
): Promise<Uint8Array | null> {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);
    if (response.Body) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        if (chunk) chunks.push(chunk);
      }
      return chunks.length > 0 ? Buffer.concat(chunks) : null;
    }
    return null;
  } catch (error) {
    console.error("getObject error:", error);
    return null;
  }
}
export async function putObject(options: {
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType?: string;
}): Promise<void> {
  const {
    bucket,
    key,
    body,
    contentType = "application/octet-stream"
  } = options;
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    });
    await client.send(command);
  } catch (error) {
    console.error("putObject error:", error);
    throw error;
  }
}
export function ticketAttachmentKey(
  chatFeatureId: string,
  attachmentId: string
): string {
  return `tickets/${chatFeatureId}/att/${attachmentId}`;
}
export async function objectExists(
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
    await client.send(command);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "$metadata" in error &&
      (
        error as {
          $metadata?: {
            httpStatusCode?: number;
          };
        }
      ).$metadata?.httpStatusCode === N_404
    ) {
      return false;
    }
    console.error("objectExists error:", error);
    throw error;
  }
}
export async function listObjectsWithPrefix(
  bucket: string,
  prefix: string
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken
      })
    );
    for (const obj of listed.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return keys;
}
export async function deleteObject(bucket: string, key: string): Promise<void> {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    console.error("deleteObject error:", error);
    throw error;
  }
}
export async function deleteObjectsWithPrefix(
  bucket: string,
  prefix: string
): Promise<void> {
  try {
    let continuationToken: string | undefined;
    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })
      );
      const objects = (listed.Contents || [])
        .map((obj) => (obj.Key ? { Key: obj.Key } : null))
        .filter(
          (
            obj
          ): obj is {
            Key: string;
          } => obj !== null
        );
      if (objects.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects }
          })
        );
      }
      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);
  } catch (error) {
    console.error("deleteObjectsWithPrefix error:", error);
    throw error;
  }
}
