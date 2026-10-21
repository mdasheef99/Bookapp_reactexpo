import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export const PDF_RENDER_TIMEOUT_MS = 60_000;

export interface TextFileDelivery { fileName: string; mimeType: string; text: string }
export interface PdfDelivery { fileName: string; html: string }
export interface PreparedPdf { print: () => void; dispose: () => void }

export class ExportUnavailableError extends Error {
  constructor() {
    super('Export is unavailable on this platform.');
    this.name = 'ExportUnavailableError';
  }
}

export function exportDeliveryAvailable(): boolean { return true; }
export function pdfNeedsPrintStep(): boolean { return false; }

const UTIS: Record<string, string> = {
  'text/csv': 'public.comma-separated-values-text',
  'text/markdown': 'net.daringfireball.markdown',
  'application/pdf': 'com.adobe.pdf',
};

async function createExportDirectory(): Promise<string> {
  const available = await Sharing.isAvailableAsync();
  if (!available || !FileSystem.cacheDirectory) throw new ExportUnavailableError();
  const attemptId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const directory = `${FileSystem.cacheDirectory}exports/${attemptId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

async function deleteFile(uri: string): Promise<void> {
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); }
  catch { /* Cleanup must not mask the delivery result; OS cache cleanup is the fallback. */ }
}

export async function deliverTextFile({ fileName, mimeType, text }: TextFileDelivery): Promise<'shared'> {
  const directory = await createExportDirectory();
  const uri = `${directory}${fileName}`;
  try {
    await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName, UTI: UTIS[mimeType.split(';')[0]] });
    return 'shared';
  } finally {
    await deleteFile(uri);
    await deleteFile(directory);
  }
}

export async function deliverPdfFile({ fileName, html }: PdfDelivery): Promise<'shared'> {
  const directory = await createExportDirectory();
  const uri = `${directory}${fileName}`;
  let printedUri: string | undefined;
  let renderTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const rendering = Print.printToFileAsync({ html });
    const printed = await Promise.race([
      rendering,
      new Promise<never>((_, reject) => {
        renderTimeout = setTimeout(() => {
          // A timed-out native render may still create a file later.
          void rendering.then(late => deleteFile(late.uri)).catch(() => {});
          reject(new Error('PDF rendering timed out.'));
        }, PDF_RENDER_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(renderTimeout);
    printedUri = printed.uri;
    await FileSystem.moveAsync({ from: printedUri, to: uri });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: UTIS['application/pdf'] });
    return 'shared';
  } finally {
    clearTimeout(renderTimeout);
    await deleteFile(uri);
    if (printedUri) await deleteFile(printedUri);
    await deleteFile(directory);
  }
}

export function preparePdf(_file: PdfDelivery): PreparedPdf { throw new ExportUnavailableError(); }
export function printPreparedPdf(_prepared: PreparedPdf): void { throw new ExportUnavailableError(); }
export function disposePreparedPdf(_prepared: PreparedPdf): void { throw new ExportUnavailableError(); }

export async function deliverImageFile({ fileName, sourceUri }: { fileName: string; sourceUri: string }): Promise<'shared'> {
  let directory: string | undefined;
  let uri: string | undefined;
  try {
    directory = await createExportDirectory();
    uri = `${directory}${fileName}`;
    await FileSystem.moveAsync({ from: sourceUri, to: uri });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: fileName, UTI: 'public.png' });
    return 'shared';
  } finally {
    if (uri) await deleteFile(uri);
    await deleteFile(sourceUri);
    if (directory) await deleteFile(directory);
  }
}
