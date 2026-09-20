"use client";
import Shell from '@/components/Shell';
import { useState, useEffect, useCallback } from "react";

interface DocFile {
  doc_id: string;
  file_name: string | null;
  file_size_bytes: number | null;
  created_at: string | null;
}

const COOLDOWN_SECONDS = 60;

export default function UploadPage() {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "warning" | "error">("success");
  const [cooldown, setCooldown] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ingest", { cache: "no-store" });
      const json = await res.json();
      setFiles(json.files ?? []);
    } catch {
      // silently fail on background refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function resetForm() {
    setFileInputKey((k) => k + 1);
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!file || !(file instanceof File) || file.size === 0) {
      setMessage("Please select a file before uploading.");
      setMessageType("error");
      return;
    }

    setUploading(true);

    try {
      const res = await fetch("/api/ingest", { method: "POST", body: formData });

      if (res.status === 409) {
        setMessage("⚠️ Duplicate file — this document already exists.");
        setMessageType("warning");
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setMessage(`❌ Upload failed: ${json.error ?? "Unknown error."}`);
        setMessageType("error");
        return;
      }

      setMessage("✅ File uploaded successfully.");
      setMessageType("success");
      resetForm();
      await fetchFiles(); // auto-refresh bypasses cooldown
    } catch {
      setMessage("❌ Upload failed. Please check your connection.");
      setMessageType("error");
    } finally {
      setUploading(false);
    }
  }

  function handleManualRefresh() {
    if (cooldown > 0) return;
    setCooldown(COOLDOWN_SECONDS);
    fetchFiles();
  }

  function formatBytes(bytes: number | null): string {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <Shell>
      <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-white mb-6">Document Ingestion</h1>

        {/* Upload Form */}
        <form
          onSubmit={handleUpload}
          className="bg-[#161b22] border border-[#30363d] rounded-lg p-5 mb-8 space-y-4"
        >
          <div>
            <label className="block text-sm text-[#8b949e] mb-1">File</label>
            <input
              key={fileInputKey}
              type="file"
              name="file"
              className="w-full text-sm text-[#c9d1d9] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-[#21262d] file:text-[#c9d1d9] hover:file:bg-[#30363d] cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm text-[#8b949e] mb-1">Uploaded by (optional)</label>
            <input
              type="text"
              name="created_by"
              placeholder="e.g. analyst@meip.io"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>

          {message && (
            <p
              className={`text-sm mt-1 ${
                messageType === "warning"
                  ? "text-yellow-400"
                  : messageType === "error"
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {message}
            </p>
          )}
        </form>

        {/* File List */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-white">Ingested Documents</h2>
            <button
              onClick={handleManualRefresh}
              disabled={cooldown > 0 || loading}
              className="text-xs bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 text-[#8b949e] px-3 py-1.5 rounded transition-colors"
            >
              {cooldown > 0 ? `Refresh (${cooldown}s)` : loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {files.length === 0 ? (
            <p className="text-sm text-[#484f58]">No documents ingested yet.</p>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.doc_id}
                  className="flex items-center justify-between bg-[#0d1117] border border-[#21262d] rounded px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[#c9d1d9] truncate">
                      {f.file_name ?? f.doc_id.slice(0, 16) + "…"}
                    </p>
                    <p className="text-xs text-[#484f58] mt-0.5 font-mono truncate">
                      {f.doc_id}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[#8b949e] ml-4 shrink-0">
                    <p>{formatBytes(f.file_size_bytes)}</p>
                    <p>{formatDate(f.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Shell>
  );
}
