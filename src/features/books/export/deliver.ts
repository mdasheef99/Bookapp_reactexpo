export interface TextFileDelivery { fileName: string; mimeType: string; text: string }
export interface PdfDelivery { fileName: string; html: string }
export interface PreparedPdf { print: () => void; dispose: () => void }

export class ExportUnavailableError extends Error {
  constructor() {
    super('Export is unavailable on this platform.');
    this.name = 'ExportUnavailableError';
  }
}

// Unit 3 replaces this stub with native file delivery.
export function exportDeliveryAvailable(): boolean { return false; }
export async function deliverTextFile(_file: TextFileDelivery): Promise<'saved'> { throw new ExportUnavailableError(); }
export function preparePdf(_file: PdfDelivery): PreparedPdf { throw new ExportUnavailableError(); }
export function printPreparedPdf(_prepared: PreparedPdf): void { throw new ExportUnavailableError(); }
export function disposePreparedPdf(_prepared: PreparedPdf): void { throw new ExportUnavailableError(); }
