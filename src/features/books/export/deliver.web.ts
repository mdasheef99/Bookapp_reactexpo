// Keep types local: importing ./deliver here would resolve back to this file on web.
interface TextFileDelivery { fileName: string; mimeType: string; text: string }
interface PdfDelivery { fileName: string; html: string }
export interface PreparedPdf { print: () => void; dispose: () => void }
const PRINT_CLEANUP_TIMEOUT_MS = 60_000;

export function exportDeliveryAvailable(): boolean { return true; }

export function pdfNeedsPrintStep(): boolean { return true; }
export async function deliverPdfFile(_file: PdfDelivery): Promise<'shared'> {
  throw new Error('Export is unavailable on this platform.');
}

export async function deliverTextFile({ fileName, mimeType, text }: TextFileDelivery): Promise<'saved'> {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  let anchor: HTMLAnchorElement | undefined;
  try {
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    return 'saved';
  } finally {
    anchor?.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

export function preparePdf({ fileName, html }: PdfDelivery): PreparedPdf {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
  let printWindow: Window | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout);
    printWindow?.removeEventListener('afterprint', cleanup);
    frame.remove();
  };
  try {
    document.body.appendChild(frame);
    printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) throw new Error('Print is unavailable.');
    printDocument.open();
    printDocument.write(html);
    printDocument.close();
    printDocument.title = fileName;
    printWindow.addEventListener('afterprint', cleanup);
    return {
      dispose: cleanup,
      print: () => {
        if (disposed) throw new Error('Print is unavailable.');
        try {
          clearTimeout(timeout);
          timeout = setTimeout(cleanup, PRINT_CLEANUP_TIMEOUT_MS);
          // Synchronous: callers invoke this from the final Print press.
          // Browsers cannot reliably distinguish printing from dismissal.
          printWindow!.print();
        } catch (error) {
          cleanup();
          throw error;
        }
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function printPreparedPdf(prepared: PreparedPdf): void { prepared.print(); }
export function disposePreparedPdf(prepared: PreparedPdf): void { prepared.dispose(); }
