// Import web explicitly: Jest's default ../deliver resolves the native file.
import { preparePdf, printPreparedPdf, disposePreparedPdf, deliverTextFile, exportDeliveryAvailable,
  pdfNeedsPrintStep, deliverPdfFile, deliverImageFile, ExportUnavailableError as WebExportUnavailableError } from '../deliver.web';
import { preparePdf as nativePrepare, printPreparedPdf as nativePrint, disposePreparedPdf as nativeDispose,
  deliverTextFile as nativeText, ExportUnavailableError,
  exportDeliveryAvailable as nativeAvailable } from '../deliver';

jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' },
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined), writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

it('rejects image delivery on web with ExportUnavailableError', async () => {
  await expect(deliverImageFile({ fileName: 'quote.png', sourceUri: 'file:///capture.png' })).rejects.toBeInstanceOf(WebExportUnavailableError);
});
const originalBlob = Object.getOwnPropertyDescriptor(globalThis, 'Blob');
const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
let anchor: any, frame: any, printWindow: any, printDocument: any, documentMock: any;
const restore = (object: object, key: string, descriptor?: PropertyDescriptor) => {
  if (descriptor) Object.defineProperty(object, key, descriptor);
  else Reflect.deleteProperty(object, key);
};
beforeEach(() => {
  jest.useFakeTimers();
  anchor = { click: jest.fn(), remove: jest.fn() };
  printWindow = { print: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() };
  printDocument = { open: jest.fn(), write: jest.fn(), close: jest.fn() };
  frame = { style: {}, setAttribute: jest.fn(), remove: jest.fn(), contentWindow: printWindow, contentDocument: printDocument };
  documentMock = { createElement: jest.fn((name: string) => name === 'a' ? anchor : frame), body: { appendChild: jest.fn() } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
  Object.defineProperty(globalThis, 'Blob', { configurable: true, value: jest.fn().mockImplementation(() => ({ blob: true })) });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:export') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
});
afterEach(() => {
  jest.useRealTimers();
  restore(globalThis, 'document', originalDocument); restore(globalThis, 'Blob', originalBlob);
  restore(URL, 'createObjectURL', originalCreate); restore(URL, 'revokeObjectURL', originalRevoke);
});
function afterPrint() { printWindow.addEventListener.mock.calls.find((call: any[]) => call[0] === 'afterprint')[1](); }

it('imports without document or object-URL APIs and reports web delivery capability', () => {
  Reflect.deleteProperty(globalThis, 'document');
  Reflect.deleteProperty(URL, 'createObjectURL');
  jest.isolateModules(() => expect(() => require('../deliver.web')).not.toThrow());
  expect(exportDeliveryAvailable()).toBe(true);
});

it.each(['text/csv;charset=utf-8', 'text/markdown;charset=utf-8'])('downloads a UTF-8 Blob with the provided type %s and filename, then removes and revokes', async mimeType => {
  const text = '\uFEFFशीर्षक,author\r\n';
  expect(await deliverTextFile({ fileName: 'notes.md', mimeType, text })).toBe('saved');
  expect(Blob).toHaveBeenCalledWith([text], { type: mimeType });
  expect(URL.createObjectURL).toHaveBeenCalledWith({ blob: true });
  expect(anchor).toMatchObject({ download: 'notes.md', href: 'blob:export', hidden: true });
  expect(documentMock.body.appendChild).toHaveBeenCalledWith(anchor);
  expect(anchor.click).toHaveBeenCalledTimes(1);
  expect(anchor.remove).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  jest.advanceTimersByTime(29_999);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
  expect(anchor.click.mock.invocationCallOrder[0]).toBeLessThan(anchor.remove.mock.invocationCallOrder[0]);
  expect(anchor.remove.mock.invocationCallOrder[0]).toBeLessThan((URL.revokeObjectURL as jest.Mock).mock.invocationCallOrder[0]);
});

it('revokes the object URL and removes the anchor even if the click fails', async () => {
  anchor.click.mockImplementation(() => { throw new Error('download failed'); });
  await expect(deliverTextFile({ fileName: 'x.csv', mimeType: 'text/csv;charset=utf-8', text: '' })).rejects.toThrow('download failed');
  expect(anchor.remove).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  jest.advanceTimersByTime(30_000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
});

it('revokes the URL if creating the link fails', async () => {
  documentMock.createElement.mockImplementation(() => { throw new Error('no DOM'); });
  await expect(deliverTextFile({ fileName: 'x', mimeType: 'text/markdown;charset=utf-8', text: 'x' })).rejects.toThrow('no DOM');
  jest.advanceTimersByTime(30_000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
});

it('prepares without printing, then prints synchronously and removes the frame after afterprint', async () => {
  const prepared = preparePdf({ fileName: 'notes.pdf', html: '<html><body>नमस्ते</body></html>' });
  expect(printWindow.print).not.toHaveBeenCalled();
  let promiseResolved = false;
  const pending = Promise.resolve().then(() => { promiseResolved = true; });
  printWindow.print.mockImplementation(() => { expect(promiseResolved).toBe(false); });
  expect(printPreparedPdf(prepared)).toBeUndefined();
  expect(documentMock.createElement).toHaveBeenCalledWith('iframe');
  expect(frame).not.toHaveProperty('src');
  expect(frame.style).toMatchObject({ opacity: '0', pointerEvents: 'none' });
  expect(frame.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
  expect(frame.tabIndex).toBe(-1);
  expect(documentMock.body.appendChild).toHaveBeenCalledWith(frame);
  expect(printDocument.write).toHaveBeenCalledWith('<html><body>नमस्ते</body></html>');
  expect(printDocument.title).toBe('notes.pdf');
  expect(printWindow.print).toHaveBeenCalledTimes(1); // Before the first await.
  expect(printDocument.close.mock.invocationCallOrder[0]).toBeLessThan(printWindow.print.mock.invocationCallOrder[0]);
  expect(frame.remove).not.toHaveBeenCalled();
  afterPrint();
  expect(frame.remove).toHaveBeenCalledTimes(1);
  expect(printWindow.removeEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function));
  jest.runOnlyPendingTimers();
  expect(frame.remove).toHaveBeenCalledTimes(1);
  await pending;
  expect(promiseResolved).toBe(true);
});

it('returns from print immediately and removes the frame at 60 seconds without afterprint', () => {
  const prepared = preparePdf({ fileName: 'x.pdf', html: '<p>x</p>' });
  expect(printPreparedPdf(prepared)).toBeUndefined();
  jest.advanceTimersByTime(59_999);
  expect(frame.remove).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(frame.remove).toHaveBeenCalledTimes(1);
  expect(printWindow.removeEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function));
  expect(jest.getTimerCount()).toBe(0);
});

it('disposes a prepared document before Print and safely ignores repeated cleanup', () => {
  const prepared = preparePdf({ fileName: 'x.pdf', html: 'x' });
  disposePreparedPdf(prepared);
  disposePreparedPdf(prepared);
  expect(frame.remove).toHaveBeenCalledTimes(1);
  expect(printWindow.print).not.toHaveBeenCalled();
  expect(() => printPreparedPdf(prepared)).toThrow('Print is unavailable.');
  expect(jest.getTimerCount()).toBe(0);
});

it.each(['window', 'document', 'print'])('cleans up a failed print (%s)', missing => {
  if (missing === 'window') frame.contentWindow = null;
  if (missing === 'document') frame.contentDocument = null;
  if (missing === 'print') printWindow.print.mockImplementation(() => { throw new Error('print failed'); });
  expect(() => {
    const prepared = preparePdf({ fileName: 'x.pdf', html: 'x' });
    printPreparedPdf(prepared);
  }).toThrow();
  expect(frame.remove).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('offers native file sharing while keeping the prepared-print API web-only', async () => {
  expect(nativeAvailable()).toBe(true);
  await expect(nativeText({ fileName: 'x.md', mimeType: 'text/markdown;charset=utf-8', text: 'x' })).resolves.toBe('shared');
  expect(() => nativePrepare({ fileName: 'x', html: 'x' })).toThrow(ExportUnavailableError);
  const prepared = { print: jest.fn(), dispose: jest.fn() };
  expect(() => nativePrint(prepared)).toThrow(ExportUnavailableError);
  expect(() => nativeDispose(prepared)).toThrow(ExportUnavailableError);
});

it('requires the existing web Print step and rejects the native one-step PDF API', async () => {
  expect(pdfNeedsPrintStep()).toBe(true);
  await expect(deliverPdfFile({ fileName: 'x.pdf', html: 'x' })).rejects.toThrow();
  expect(documentMock.createElement).not.toHaveBeenCalled();
});
