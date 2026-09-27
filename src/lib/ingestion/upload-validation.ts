export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const FILE_TYPES: Record<string, readonly string[]> = {
  pdf: ['application/pdf'], html: ['text/html'], htm: ['text/html'], txt: ['text/plain'],
  xml: ['application/xml', 'text/xml'], csv: ['text/csv', 'application/vnd.ms-excel'],
  json: ['application/json'], zip: ['application/zip', 'application/x-zip-compressed'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};
export function validateUpload(file: {name: string; size: number; type: string}): string | null {
  if (file.size <= 0) return 'Select a non-empty file.';
  if (file.size > MAX_UPLOAD_BYTES) return 'File exceeds the 20 MB limit.';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const types = FILE_TYPES[ext];
  if (!types || (file.type && file.type !== 'application/octet-stream' && !types.includes(file.type))) return 'Unsupported file type. Use PDF, HTML, TXT, XML, CSV, JSON, ZIP, or XLSX.';
  return null;
}
