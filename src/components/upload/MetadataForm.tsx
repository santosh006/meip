"use client";

export interface FilingMeta {
  companyId: string;
  filingType: string;
  filingDate: string;
  accessionNumber: string;
  sourceUrl: string;
}

interface MetadataFormProps {
  meta: FilingMeta;
  onChange: (meta: FilingMeta) => void;
  disabled?: boolean;
}

const FILING_TYPES = ["10-K", "10-Q", "8-K", "20-F", "Annual Report", "Proxy Statement", "Other"];

export default function MetadataForm({ meta, onChange, disabled }: MetadataFormProps) {
  const update = (field: keyof FilingMeta) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => onChange({ ...meta, [field]: e.target.value });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <p className="text-sm font-medium text-gray-700">
        Filing Metadata{" "}
        <span className="text-gray-400 font-normal">(optional)</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Company ID" htmlFor="companyId">
          <input
            id="companyId"
            type="text"
            placeholder="e.g. AAPL"
            value={meta.companyId}
            onChange={update("companyId")}
            disabled={disabled}
            className={inputClass}
          />
        </Field>

        <Field label="Filing Type" htmlFor="filingType">
          <select
            id="filingType"
            value={meta.filingType}
            onChange={update("filingType")}
            disabled={disabled}
            className={inputClass}
          >
            <option value="">Select type…</option>
            {FILING_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="Filing Date" htmlFor="filingDate">
          <input
            id="filingDate"
            type="date"
            value={meta.filingDate}
            onChange={update("filingDate")}
            disabled={disabled}
            className={inputClass}
          />
        </Field>

        <Field label="Accession Number" htmlFor="accessionNumber">
          <input
            id="accessionNumber"
            type="text"
            placeholder="e.g. 0000320193-23-000106"
            value={meta.accessionNumber}
            onChange={update("accessionNumber")}
            disabled={disabled}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Source URL" htmlFor="sourceUrl">
        <input
          id="sourceUrl"
          type="url"
          placeholder="https://…"
          value={meta.sourceUrl}
          onChange={update("sourceUrl")}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

function Field({ label, htmlFor, children }: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
  "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
  "focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed w-full";
