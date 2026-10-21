import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
// Explicit native implementation; web delivery is tested via ../deliver.web.
import { deliverTextFile, deliverPdfFile, exportDeliveryAvailable, pdfNeedsPrintStep,
  ExportUnavailableError, preparePdf, printPreparedPdf, disposePreparedPdf, PDF_RENDER_TIMEOUT_MS } from '../deliver';

let mockCacheDirectory: string | null = 'file:///cache/';
jest.mock('expo-file-system/legacy', () => ({
  get cacheDirectory() { return mockCacheDirectory; },
  EncodingType: { UTF8: 'utf8' },
  makeDirectoryAsync: jest.fn(), writeAsStringAsync: jest.fn(), moveAsync: jest.fn(), deleteAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
const fs = jest.mocked(FileSystem), sharing = jest.mocked(Sharing), print = jest.mocked(Print);
const textFile = { fileName: 'library.csv', mimeType: 'text/csv;charset=utf-8', text: '\uFEFFtitle,author\r\nशीर्षक,लेखक\r\n' };
const pdfFile = { fileName: 'notes-walden.pdf', html: '<html><body>नमस्ते ಕನ್ನಡ</body></html>' };
const attemptDirectory = 'file:///cache/exports/9ix-i/';
const namedText = `${attemptDirectory}library.csv`;
const namedPdf = `${attemptDirectory}notes-walden.pdf`;
const printedPdf = 'file:///cache/Print/generated.pdf';

beforeEach(() => {
  jest.resetAllMocks(); mockCacheDirectory = 'file:///cache/';
  jest.spyOn(Date, 'now').mockReturnValue(12345);
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  sharing.isAvailableAsync.mockResolvedValue(true); sharing.shareAsync.mockResolvedValue(undefined);
  fs.makeDirectoryAsync.mockResolvedValue(undefined); fs.writeAsStringAsync.mockResolvedValue(undefined);
  fs.moveAsync.mockResolvedValue(undefined); fs.deleteAsync.mockResolvedValue(undefined);
  print.printToFileAsync.mockResolvedValue({ uri: printedPdf, numberOfPages: 1 });
});

afterEach(() => { jest.restoreAllMocks(); });

function expectCleanup(...uris: string[]) {
  expect(fs.deleteAsync.mock.calls).toEqual(uris.map(uri => [uri, { idempotent: true }]));
}

it('offers native exports without a separate Print step', () => {
  expect(exportDeliveryAvailable()).toBe(true);
  expect(pdfNeedsPrintStep()).toBe(false);
  expect(sharing.isAvailableAsync).not.toHaveBeenCalled();
});

it.each([
  ['library.csv', 'text/csv;charset=utf-8', 'public.comma-separated-values-text'],
  ['notes.md', 'text/markdown;charset=utf-8', 'net.daringfireball.markdown'],
  ['notes.pdf', 'application/pdf', 'com.adobe.pdf'],
])('writes and shares %s using its exact name, UTF-8 contents and type, then deletes it', async (fileName, mimeType, UTI) => {
  const uri = `${attemptDirectory}${fileName}`;
  await expect(deliverTextFile({ fileName, mimeType, text: textFile.text })).resolves.toBe('shared');
  expect(sharing.isAvailableAsync).toHaveBeenCalledTimes(1);
  expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(attemptDirectory, { intermediates: true });
  expect(fs.writeAsStringAsync).toHaveBeenCalledWith(uri, textFile.text, { encoding: 'utf8' });
  expect(sharing.shareAsync).toHaveBeenCalledWith(uri, { mimeType, dialogTitle: fileName, UTI });
  expect(fs.deleteAsync).toHaveBeenCalledTimes(2);
  expect(fs.deleteAsync).toHaveBeenCalledWith(uri, { idempotent: true });
  expectCleanup(uri, attemptDirectory);
  expect(sharing.isAvailableAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.makeDirectoryAsync.mock.invocationCallOrder[0]);
  expect(fs.makeDirectoryAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.writeAsStringAsync.mock.invocationCallOrder[0]);
  expect(fs.writeAsStringAsync.mock.invocationCallOrder[0]).toBeLessThan(sharing.shareAsync.mock.invocationCallOrder[0]);
  expect(sharing.shareAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.deleteAsync.mock.invocationCallOrder[0]);
});

it('retains a text file until the share sheet settles, including dismissal', async () => {
  let dismiss!: () => void;
  sharing.shareAsync.mockImplementationOnce(() => new Promise<void>(resolve => { dismiss = resolve; }));
  const pending = deliverTextFile(textFile).catch(error => error);
  for (let n = 0; n < 8; n++) await Promise.resolve();
  expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
  expect(fs.deleteAsync).not.toHaveBeenCalled();
  dismiss();
  await expect(pending).resolves.toBe('shared');
  expect(fs.deleteAsync).toHaveBeenCalledWith(namedText, { idempotent: true });
  expectCleanup(namedText, attemptDirectory);
});

it.each([false, true])('deletes a text file after a share error and preserves that error (delete fails=%s)', async deleteFails => {
  const error = new Error('share failed');
  sharing.shareAsync.mockRejectedValueOnce(error);
  if (deleteFails) fs.deleteAsync.mockRejectedValue(new Error('cleanup failed'));
  await expect(deliverTextFile(textFile)).rejects.toBe(error);
  expect(fs.deleteAsync).toHaveBeenCalledWith(namedText, { idempotent: true });
  expectCleanup(namedText, attemptDirectory);
});

it.each([namedText, attemptDirectory])('keeps a successful share result when deleting %s fails', async failedUri => {
  fs.deleteAsync.mockImplementation(async uri => { if (uri === failedUri) throw new Error('cleanup failed'); });
  await expect(deliverTextFile(textFile)).resolves.toBe('shared');
  expect(fs.deleteAsync).toHaveBeenCalledWith(namedText, { idempotent: true });
  expectCleanup(namedText, attemptDirectory);
});

it('cleans up a partial text write without sharing or masking the write error', async () => {
  const error = new Error('write failed');
  fs.writeAsStringAsync.mockRejectedValueOnce(error);
  await expect(deliverTextFile(textFile)).rejects.toBe(error);
  expect(sharing.shareAsync).not.toHaveBeenCalled();
  expect(fs.deleteAsync).toHaveBeenCalledWith(namedText, { idempotent: true });
  expectCleanup(namedText, attemptDirectory);
});

it.each(['text', 'pdf'] as const)('rejects %s delivery before creating files when sharing is unavailable', async kind => {
  sharing.isAvailableAsync.mockResolvedValue(false);
  await expect(kind === 'text' ? deliverTextFile(textFile) : deliverPdfFile(pdfFile)).rejects.toBeInstanceOf(ExportUnavailableError);
  expect(sharing.isAvailableAsync).toHaveBeenCalledTimes(1);
  expect(fs.makeDirectoryAsync).not.toHaveBeenCalled(); expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  expect(print.printToFileAsync).not.toHaveBeenCalled(); expect(sharing.shareAsync).not.toHaveBeenCalled();
});

it.each(['text', 'pdf'] as const)('rejects %s delivery when there is no cache directory', async kind => {
  mockCacheDirectory = null;
  await expect(kind === 'text' ? deliverTextFile(textFile) : deliverPdfFile(pdfFile)).rejects.toBeInstanceOf(ExportUnavailableError);
  expect(fs.makeDirectoryAsync).not.toHaveBeenCalled(); expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  expect(print.printToFileAsync).not.toHaveBeenCalled(); expect(fs.moveAsync).not.toHaveBeenCalled();
  expect(sharing.shareAsync).not.toHaveBeenCalled(); expect(fs.deleteAsync).not.toHaveBeenCalled();
});

it('rechecks share availability for every delivery', async () => {
  await deliverTextFile(textFile);
  sharing.isAvailableAsync.mockResolvedValueOnce(false);
  await expect(deliverPdfFile(pdfFile)).rejects.toBeInstanceOf(ExportUnavailableError);
  expect(sharing.isAvailableAsync).toHaveBeenCalledTimes(2);
  expect(print.printToFileAsync).not.toHaveBeenCalled();
});

it('prints HTML, moves the PDF to its export name, shares it, then deletes both paths and its directory', async () => {
  await expect(deliverPdfFile(pdfFile)).resolves.toBe('shared');
  expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(attemptDirectory, { intermediates: true });
  expect(print.printToFileAsync).toHaveBeenCalledWith({ html: pdfFile.html });
  expect(fs.moveAsync).toHaveBeenCalledWith({ from: printedPdf, to: namedPdf });
  expect(sharing.shareAsync).toHaveBeenCalledWith(namedPdf, {
    mimeType: 'application/pdf', dialogTitle: 'notes-walden.pdf', UTI: 'com.adobe.pdf',
  });
  expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  expect(fs.deleteAsync).toHaveBeenCalledTimes(3);
  expect(fs.deleteAsync).toHaveBeenCalledWith(printedPdf, { idempotent: true });
  expect(fs.deleteAsync).toHaveBeenCalledWith(namedPdf, { idempotent: true });
  expectCleanup(namedPdf, printedPdf, attemptDirectory);
  expect(fs.makeDirectoryAsync.mock.invocationCallOrder[0]).toBeLessThan(print.printToFileAsync.mock.invocationCallOrder[0]);
  expect(print.printToFileAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.moveAsync.mock.invocationCallOrder[0]);
  expect(fs.moveAsync.mock.invocationCallOrder[0]).toBeLessThan(sharing.shareAsync.mock.invocationCallOrder[0]);
  expect(sharing.shareAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.deleteAsync.mock.invocationCallOrder[0]);
});

describe('PDF render timeout', () => {
  beforeEach(() => { jest.useFakeTimers({ now: 12345 }); });
  afterEach(() => { jest.useRealTimers(); });

  it('rejects a stalled render after exactly 60 seconds and cleans up without sharing', async () => {
    print.printToFileAsync.mockImplementationOnce(() => new Promise(() => {}));
    const settled = jest.fn();
    const pending = deliverPdfFile(pdfFile).then(settled, settled);
    await jest.advanceTimersByTimeAsync(0);
    expect(print.printToFileAsync).toHaveBeenCalledWith({ html: pdfFile.html });
    await jest.advanceTimersByTimeAsync(59_999);
    expect(settled).not.toHaveBeenCalled();
    expect(fs.deleteAsync).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith(new Error('PDF rendering timed out.'));
    expect(settled.mock.calls[0][0].constructor).toBe(Error);
    await pending;
    expect(PDF_RENDER_TIMEOUT_MS).toBe(60_000);
    expect(fs.moveAsync).not.toHaveBeenCalled();
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    expectCleanup(namedPdf, attemptDirectory);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([false, true])('deletes a late rendered URI idempotently without surfacing cleanup failures (delete fails=%s)', async deleteFails => {
    let finish!: (result: Awaited<ReturnType<typeof Print.printToFileAsync>>) => void;
    print.printToFileAsync.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const settled = jest.fn();
    const pending = deliverPdfFile(pdfFile).then(settled, settled);
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(settled).toHaveBeenCalledWith(new Error('PDF rendering timed out.'));
    await pending;
    expectCleanup(namedPdf, attemptDirectory);
    if (deleteFails) fs.deleteAsync.mockRejectedValueOnce(new Error('late cleanup failed'));
    finish({ uri: printedPdf, numberOfPages: 1 });
    await jest.advanceTimersByTimeAsync(0);
    expectCleanup(namedPdf, attemptDirectory, printedPdf);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(fs.moveAsync).not.toHaveBeenCalled();
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the render timer before waiting for the share sheet to settle', async () => {
    let dismiss!: () => void;
    sharing.shareAsync.mockImplementationOnce(() => new Promise<void>(resolve => { dismiss = resolve; }));
    const pending = deliverPdfFile(pdfFile);
    await jest.advanceTimersByTimeAsync(0);
    expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(fs.deleteAsync).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    dismiss();
    await expect(pending).resolves.toBe('shared');
    expect(jest.getTimerCount()).toBe(0);
    expectCleanup(namedPdf, printedPdf, attemptDirectory);
  });

  it('clears the timer when rendering rejects before the deadline', async () => {
    const error = new Error('render failed');
    print.printToFileAsync.mockRejectedValueOnce(error);
    const pending = expect(deliverPdfFile(pdfFile)).rejects.toBe(error);
    await jest.advanceTimersByTimeAsync(0);
    await pending;
    expect(jest.getTimerCount()).toBe(0);
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    expectCleanup(namedPdf, attemptDirectory);
  });

  it('handles a render rejection after the timeout without changing the delivery result', async () => {
    let fail!: (error: Error) => void;
    print.printToFileAsync.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    const settled = jest.fn();
    const pending = deliverPdfFile(pdfFile).then(settled, settled);
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(settled).toHaveBeenCalledWith(new Error('PDF rendering timed out.'));
    await pending;
    fail(new Error('late render failed'));
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    expectCleanup(namedPdf, attemptDirectory);
    expect(jest.getTimerCount()).toBe(0);
  });
});

it('retains the PDF until sharing settles', async () => {
  let dismiss!: () => void;
  sharing.shareAsync.mockImplementationOnce(() => new Promise<void>(resolve => { dismiss = resolve; }));
  const pending = deliverPdfFile(pdfFile).catch(error => error);
  for (let n = 0; n < 8; n++) await Promise.resolve();
  expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
  expect(fs.deleteAsync).not.toHaveBeenCalled();
  dismiss();
  await expect(pending).resolves.toBe('shared');
  expect(fs.deleteAsync).toHaveBeenCalledTimes(3);
  expectCleanup(namedPdf, printedPdf, attemptDirectory);
});

it.each(['print', 'move', 'share'] as const)('cleans up a failed PDF %s without masking its error', async stage => {
  const error = new Error(`${stage} failed`);
  if (stage === 'print') print.printToFileAsync.mockRejectedValueOnce(error);
  if (stage === 'move') fs.moveAsync.mockRejectedValueOnce(error);
  if (stage === 'share') sharing.shareAsync.mockRejectedValueOnce(error);
  fs.deleteAsync.mockRejectedValue(new Error('cleanup failed'));
  await expect(deliverPdfFile(pdfFile)).rejects.toBe(error);
  expect(fs.deleteAsync).toHaveBeenCalledWith(namedPdf, { idempotent: true });
  if (stage !== 'print') {
    expect(fs.deleteAsync).toHaveBeenCalledWith(printedPdf, { idempotent: true });
    expect(fs.deleteAsync).toHaveBeenCalledTimes(3);
  }
  expectCleanup(namedPdf, ...(stage === 'print' ? [] : [printedPdf]), attemptDirectory);
  if (stage !== 'share') expect(sharing.shareAsync).not.toHaveBeenCalled();
});

it.each([printedPdf, namedPdf, attemptDirectory])('still attempts all PDF cleanup and preserves success when deleting %s fails', async failedUri => {
  fs.deleteAsync.mockImplementation(async uri => { if (uri === failedUri) throw new Error('cleanup failed'); });
  await expect(deliverPdfFile(pdfFile)).resolves.toBe('shared');
  expect(fs.deleteAsync).toHaveBeenCalledTimes(3);
  expect(fs.deleteAsync).toHaveBeenCalledWith(printedPdf, { idempotent: true });
  expect(fs.deleteAsync).toHaveBeenCalledWith(namedPdf, { idempotent: true });
  expectCleanup(namedPdf, printedPdf, attemptDirectory);
});

it('deletes all PDF paths and its directory after a share error even when cleanup succeeds', async () => {
  const error = new Error('share failed');
  sharing.shareAsync.mockRejectedValueOnce(error);
  await expect(deliverPdfFile(pdfFile)).rejects.toBe(error);
  expectCleanup(namedPdf, printedPdf, attemptDirectory);
});

it.each(['text', 'pdf'] as const)('isolates overlapping %s deliveries until each share settles', async kind => {
  let dismiss!: () => void;
  let shareStarted!: () => void;
  const started = new Promise<void>(resolve => { shareStarted = resolve; });
  sharing.shareAsync.mockImplementationOnce(() => {
    shareStarted();
    return new Promise<void>(resolve => { dismiss = resolve; });
  });
  jest.mocked(Math.random).mockReturnValueOnce(0.5).mockReturnValueOnce(0.25);
  const secondDirectory = 'file:///cache/exports/9ix-9/';
  const fileName = kind === 'text' ? textFile.fileName : pdfFile.fileName;
  const firstUri = `${attemptDirectory}${fileName}`;
  const secondUri = `${secondDirectory}${fileName}`;
  const secondPrintedPdf = 'file:///cache/Print/generated-2.pdf';
  print.printToFileAsync.mockResolvedValueOnce({ uri: printedPdf, numberOfPages: 1 })
    .mockResolvedValueOnce({ uri: secondPrintedPdf, numberOfPages: 1 });
  const deliver = () => kind === 'text' ? deliverTextFile(textFile) : deliverPdfFile(pdfFile);
  const pending = deliver();
  await started;
  expect(fs.deleteAsync).not.toHaveBeenCalled();
  await expect(deliver()).resolves.toBe('shared');
  expect(fs.makeDirectoryAsync.mock.calls).toEqual([
    [attemptDirectory, { intermediates: true }], [secondDirectory, { intermediates: true }],
  ]);
  expect(sharing.shareAsync).toHaveBeenNthCalledWith(1, firstUri, expect.objectContaining({ dialogTitle: fileName }));
  expect(sharing.shareAsync).toHaveBeenNthCalledWith(2, secondUri, expect.objectContaining({ dialogTitle: fileName }));
  if (kind === 'text') {
    expect(fs.writeAsStringAsync).toHaveBeenNthCalledWith(1, firstUri, textFile.text, { encoding: 'utf8' });
    expect(fs.writeAsStringAsync).toHaveBeenNthCalledWith(2, secondUri, textFile.text, { encoding: 'utf8' });
    expectCleanup(secondUri, secondDirectory);
  } else {
    expect(fs.moveAsync.mock.calls).toEqual([
      [{ from: printedPdf, to: firstUri }], [{ from: secondPrintedPdf, to: secondUri }],
    ]);
    expectCleanup(secondUri, secondPrintedPdf, secondDirectory);
  }
  dismiss();
  await expect(pending).resolves.toBe('shared');
  expectCleanup(secondUri, ...(kind === 'text' ? [] : [secondPrintedPdf]), secondDirectory,
    firstUri, ...(kind === 'text' ? [] : [printedPdf]), attemptDirectory);
});

it('keeps the web-only prepared-print API unavailable on native', () => {
  expect(() => preparePdf(pdfFile)).toThrow(ExportUnavailableError);
  const prepared = { print: jest.fn(), dispose: jest.fn() };
  expect(() => printPreparedPdf(prepared)).toThrow(ExportUnavailableError);
  expect(() => disposePreparedPdf(prepared)).toThrow(ExportUnavailableError);
});
