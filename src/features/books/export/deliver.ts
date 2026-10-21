import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export const PDF_RENDER_TIMEOUT_MS = 60_000;
export const EXPORT_RETENTION_MS = 10 * 60 * 1000;

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
  const exportRoot = `${FileSystem.cacheDirectory}exports/`;
  try {
    const entries = await FileSystem.readDirectoryAsync(exportRoot);
    const now = Date.now();
    for (const entry of entries) {
      const timestamp = parseInt(entry.split('-')[0], 36);
      // Bare names can parse as base 36, but are not timestamp-prefixed attempt IDs.
      if (!entry.includes('-') || !Number.isFinite(timestamp) || now - timestamp >= EXPORT_RETENTION_MS || timestamp - now > EXPORT_RETENTION_MS) {
        await deleteFile(`${exportRoot}${entry}`);
      }
    }
  } catch { /* A missing folder or failed sweep must not block delivery. */ }
  const attemptId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const directory = `${exportRoot}${attemptId}/`;
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
  // The receiving app may read the file after the share promise resolves.
  let shared = false;
  try {
    await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName, UTI: UTIS[mimeType.split(';')[0]] });
    shared = true;
    return 'shared';
  } finally {
    if (!shared) {
      await deleteFile(uri);
      await deleteFile(directory);
    }
  }
}

export async function deliverPdfFile({ fileName, html }: PdfDelivery): Promise<'shared'> {
  const directory = await createExportDirectory();
  const uri = `${directory}${fileName}`;
  let printedUri: string | undefined;
  let renderTimeout: ReturnType<typeof setTimeout> | undefined;
  let shared = false;
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
    shared = true;
    return 'shared';
  } finally {
    clearTimeout(renderTimeout);
    if (!shared) await deleteFile(uri);
    if (printedUri) await deleteFile(printedUri);
    if (!shared) await deleteFile(directory);
  }
}

export function preparePdf(_file: PdfDelivery): PreparedPdf { throw new ExportUnavailableError(); }
export function printPreparedPdf(_prepared: PreparedPdf): void { throw new ExportUnavailableError(); }
export function disposePreparedPdf(_prepared: PreparedPdf): void { throw new ExportUnavailableError(); }

export async function deliverImageFile({ fileName, sourceUri }: { fileName: string; sourceUri: string }): Promise<'shared'> {
  let directory: string | undefined;
  let uri: string | undefined;
  let shared = false;
  try {
    directory = await createExportDirectory();
    uri = `${directory}${fileName}`;
    await FileSystem.moveAsync({ from: sourceUri, to: uri });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: fileName, UTI: 'public.png' });
    shared = true;
    return 'shared';
  } finally {
    if (!shared && uri) await deleteFile(uri);
    await deleteFile(sourceUri);
    if (!shared && directory) await deleteFile(directory);
  }
}
