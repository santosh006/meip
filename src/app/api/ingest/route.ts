import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { ingestDocument } from "@/lib/ingestion/ingest";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("document_index")
    .select("doc_id, file_name, file_size_bytes, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ files: data ?? [] });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const createdBy = formData.get("created_by")?.toString() ?? undefined;

  try {
    const result = await ingestDocument(file, { created_by: createdBy });

    if (result.status === "duplicate") {
      return NextResponse.json(
        { error: "Duplicate file. This document already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, doc_id: result.doc_id }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
