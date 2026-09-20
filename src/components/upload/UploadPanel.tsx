"use client";

import { useState, useCallback, useRef } from "react";
import DropZone from "./DropZone";
import MetadataForm, { FilingMeta } from "./MetadataForm";
import UploadResultBadge, { UploadResult } from "./UploadResultBadge";

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "text/html",
  "text/plain",
  "application/xml",
  "text/csv",
  "application/json",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_FILE_SIZE_MB = 200;

export default function UploadPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<FilingMeta>({
    companyId: "",
    filingType: "",
    filingDate: "",
    accessionNumber: "",
    sourceUrl: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type) && file.type !== "") {
      return `Unsupported file type: ${file.type || "unknown"}. Accepted: PDF, HTML, TXT, XML, CSV, JSON, ZIP, XLSX.`;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File exceeds the ${MAX_FILE_SIZE_MB} MB limit.`;
    }
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    setResult(null);
    const error = validateFile(file);
    setValidationError(error);
    setSelectedFile(error ? null : file);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (meta.companyId)       formData.append("companyId", meta.companyId);
      if (meta.filingType)      formData.append("filingType", meta.filingType);
      if (meta.filingDate)      formData.append("filingDate", meta.filingDate);
      if (meta.accessionNumber) formData.append("accessionNumber", meta.accessionNumber);
      if (meta.sourceUrl)       formData.append("sourceUrl", meta.sourceUrl);

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          type: "error",
          message: data.detail ?? data.error ?? "Upload failed. Please try again.",
        });
      } else {
        setResult({
          type: data.status === "uploaded" ? "success" : "duplicate",
          message: data.message,
          sha256: data.sha256,
          r2ObjectKey: data.r2ObjectKey,
        });
        // Reset form on success
        setSelectedFile(null);
        setMeta({ companyId: "", filingType: "", filingDate: "", accessionNumber: "", sourceUrl: "" });
        formRef.current?.reset();
      }
    } catch {
      setResult({
        type: "error",
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Drop Zone */}
      <DropZone
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        disabled={uploading}
      />

      {validationError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {validationError}
        </p>
      )}

      {/* Optional Metadata */}
      <MetadataForm meta={meta} onChange={setMeta} disabled={uploading} />

      {/* Result Banner */}
      {result && <UploadResultBadge result={result} />}

      {/* Submit */}
      <button
        type="submit"
        disabled={!selectedFile || uploading}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5
                   text-sm font-semibold text-white shadow-sm
                   hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-indigo-600
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? (
          <>
            <Spinner />
            Uploading…
          </>
        ) : (
          "Upload Document"
        )}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
