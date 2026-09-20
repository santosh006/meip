import { createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket } from "./r2";
import { createSupabaseServer } from "@/lib/supabase-server";

interface IngestResult {
  status: "success" | "duplicate";
  doc_id: string;
}

export async function ingestDocument(
  file: File,
  metadata?: { created_by?: string }
): Promise<IngestResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const doc_id = createHash("sha256").update(buffer).digest("hex");

  const supabase = await createSupabaseServer();

  // Duplicate check
  const { data: existing } = await supabase
    .from("document_index")
    .select("doc_id")
    .eq("doc_id", doc_id)
    .maybeSingle();

  if (existing) {
    return { status: "duplicate", doc_id };
  }

  // Upload to R2
  const r2Client = getR2Client();
  const bucketName = getR2Bucket();
  const r2Key = `documents/${doc_id}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    })
  );

  // Insert into Supabase
  const { error } = await supabase.from("document_index").insert({
        doc_id,
        file_name: file.name,
        file_size_bytes: buffer.byteLength,
        r2_object_key: r2Key,
        created_by: metadata?.created_by ?? null,
    });

  if (error) {
    throw new Error(`Database insert failed: ${error.message}`);
  }

  return { status: "success", doc_id };
}
