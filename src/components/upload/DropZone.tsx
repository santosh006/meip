"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";

interface DropZoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function DropZone({ selectedFile, onFileSelect, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="File drop zone"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed
                  px-6 py-12 text-center cursor-pointer transition-colors
                  ${dragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-white hover:border-indigo-400"}
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                  `}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
        accept=".pdf,.html,.htm,.txt,.xml,.json,.csv,.xlsx,.zip"
      />

      {selectedFile ? (
        <div className="space-y-1">
          <FileIcon />
          <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
          <p className="text-xs text-gray-500">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {selectedFile.type || "unknown type"}
          </p>
          {!disabled && (
            <p className="text-xs text-indigo-500 mt-1">Click or drop to replace</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <UploadIcon />
          <p className="text-sm font-medium text-gray-700">
            Drop your file here, or{" "}
            <span className="text-indigo-600 underline underline-offset-2">browse</span>
          </p>
          <p className="text-xs text-gray-400">PDF, HTML, TXT, XML, CSV, JSON, XLSX, ZIP · Max 200 MB</p>
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg className="mx-auto h-10 w-10 text-gray-300" stroke="currentColor" fill="none" viewBox="0 0 48 48">
      <path
        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="mx-auto h-10 w-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
