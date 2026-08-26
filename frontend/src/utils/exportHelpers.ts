export type ExportFormat = 'csv' | 'excel';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function downloadExcel(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): void {
  const escapeTsv = (value: string | number) =>
    String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  const lines = [
    headers.map(escapeTsv).join('\t'),
    ...rows.map((row) => row.map(escapeTsv).join('\t')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTableData(
  format: ExportFormat,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): void {
  if (format === 'excel') {
    downloadExcel(headers, rows, filename);
  } else {
    downloadCsv(headers, rows, filename);
  }
}

export function downloadBase64Export(
  content: string,
  filename: string,
  contentType = 'application/octet-stream',
): void {
  const link = document.createElement('a');
  link.href = `data:${contentType};base64,${content}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadServerExport(
  result: { content: string; filename: string; contentType?: string },
  format: ExportFormat,
): void {
  const contentType = result.contentType
    || (format === 'excel'
      ? 'application/vnd.ms-excel;charset=utf-8'
      : 'text/csv');
  downloadBase64Export(result.content, result.filename, contentType);
}
