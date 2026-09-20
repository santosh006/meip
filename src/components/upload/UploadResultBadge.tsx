"use client";

export interface UploadResult {
  type: "success" | "duplicate" | "error";
  message: string;
  sha256?: string;
  r2ObjectKey?: string;
}

const styles = {
  success:   { wrapper: "bg-green-50 border-green-200",  text: "text-green-800",  label: "Uploaded" },
  duplicate: { wrapper: "bg-yellow-50 border-yellow-200", text: "text-yellow-800", label: "Skipped — Duplicate" },
  error:     { wrapper: "bg-red-50 border-red-200",      text: "text-red-800",    label: "Error" },
};

export default function UploadResultBadge({ result }: { result: UploadResult }) {
  const s = styles[result.type];

  return (
    <div className={`rounded-md border px-4 py-3 space-y-1 ${s.wrapper}`}>
      <p className={`text-sm font-semibold ${s.text}`}>{s.label}</p>
      <p className={`text-sm ${s.text}`}>{result.message}</p>
      {result.sha256 && (
        <p className={`text-xs font-mono break-all ${s.text} opacity-70`}>
          SHA-256: {result.sha256}
        </p>
      )}
    </div>
  );
}
