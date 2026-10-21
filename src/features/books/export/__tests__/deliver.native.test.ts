import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
// Explicit native implementation; web delivery is tested via ../deliver.web.
import { deliverTextFile, deliverPdfFile, deliverImageFile, exportDeliveryAvailable, pdfNeedsPrintStep,
  ExportUnavailableError, preparePdf, printPreparedPdf, disposePreparedPdf, PDF_RENDER_TIMEOUT_MS, EXPORT_RETENTION_MS } from '../deliver';

let mockCacheDirectory: string | null = 'file:///cache/';
jest.mock('expo-file-system/legacy', () => ({
  get cacheDirectory() { return mockCacheDirectory; },
  EncodingType: { UTF8: 'utf8' },
  readDirectoryAsync: jest.fn(), makeDirectoryAsync: jest.fn(), writeAsStringAsync: jest.fn(), moveAsync: jest.fn(), deleteAsync: jest.fn(),
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
  fs.readDirectoryAsync.mockResolvedValue([]);
  fs.makeDirectoryAsync.mockResolvedValue(undefined); fs.writeAsStringAsync.mockResolvedValue(undefined);
  fs.moveAsync.mockResolvedValue(undefined); fs.deleteAsync.mockResolvedValue(undefined);
  print.printToFileAsync.mockResolvedValue({ uri: printedPdf, numberOfPages: 1 });
});

afterEach(() => { jest.restoreAllMocks(); });

function expectCleanup(...uris: string[]) {
  expect(fs.deleteAsync.mock.calls).toEqual(uris.map(uri => [uri, { idempotent: true }]));
}

describe('image delivery', () => {
  const image = { fileName: 'quote-walden.png', sourceUri: 'file:///cache/captured.png' };
  const uri = `${attemptDirectory}${image.fileName}`;
  it('moves the capture into an attempt directory, shares PNG, and deletes only the capture source', async () => {
    await expect(deliverImageFile(image)).resolves.toBe('shared');
    expect(sharing.isAvailableAsync).toHaveBeenCalledTimes(1);
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(attemptDirectory, { intermediates: true });
    expect(fs.moveAsync).toHaveBeenCalledWith({ from: image.sourceUri, to: uri });
    expect(sharing.shareAsync).toHaveBeenCalledWith(uri, { mimeType: 'image/png', dialogTitle: image.fileName, UTI: 'public.png' });
    expect(fs.moveAsync.mock.invocationCallOrder[0]).toBeLessThan(sharing.shareAsync.mock.invocationCallOrder[0]);
    expect(sharing.shareAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.deleteAsync.mock.invocationCallOrder[0]);
    expectCleanup(image.sourceUri);
  });
  it.each([false, true])('cleans all paths and preserves a share error (cleanup fails=%s)', async deleteFails => {
    const error = new Error('share failed');
    sharing.shareAsync.mockRejectedValueOnce(error);
    if (deleteFails) fs.deleteAsync.mockRejectedValue(new Error('cleanup failed'));
    await expect(deliverImageFile(image)).rejects.toBe(error);
    expectCleanup(uri, image.sourceUri, attemptDirectory);
  });
  it.each([uri, image.sourceUri, attemptDirectory])('preserves success and deletes only the capture source when deleting %s would fail', async failedUri => {
    fs.deleteAsync.mockImplementation(async path => { if (path === failedUri) throw new Error('cleanup failed'); });
    await expect(deliverImageFile(image)).resolves.toBe('shared');
    expectCleanup(image.sourceUri);
  });
  it.each(['unavailable', 'no cache', 'check throws'] as const)('cleans the captured file when sharing is %s', async reason => {
    if (reason === 'unavailable') sharing.isAvailableAsync.mockResolvedValue(false);
    if (reason === 'no cache') mockCacheDirectory = null;
    const error = new Error('availability failed');
    if (reason === 'check throws') sharing.isAvailableAsync.mockRejectedValue(error);
    await expect(deliverImageFile(image)).rejects.toBeInstanceOf(reason === 'check throws' ? Error : ExportUnavailableError);
    expect(fs.moveAsync).not.toHaveBeenCalled(); expect(sharing.shareAsync).not.toHaveBeenCalled();
    expect(fs.readDirectoryAsync).not.toHaveBeenCalled();
    expectCleanup(image.sourceUri);
  });
  it('cleans up a failed move without sharing', async () => {
    const error = new Error('move failed'); fs.moveAsync.mockRejectedValueOnce(error);
    await expect(deliverImageFile(image)).rejects.toBe(error);
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    expectCleanup(uri, image.sourceUri, attemptDirectory);
  });
  it('keeps the shared image and directory after the share sheet settles', async () => {
    let dismiss!: () => void;
    let shareStarted!: () => void;
    const started = new Promise<void>(resolve => { shareStarted = resolve; });
    sharing.shareAsync.mockImplementationOnce(() => {
      shareStarted();
      return new Promise<void>(resolve => { dismiss = resolve; });
    });
    const pending = deliverImageFile(image);
    await started;
    expectCleanup();
    dismiss();
    await expect(pending).resolves.toBe('shared');
    expectCleanup(image.sourceUri);
  });
});

it('offers native exports without a separate Print step', () => {
  expect(exportDeliveryAvailable()).toBe(true);
  expect(pdfNeedsPrintStep()).toBe(false);
  expect(sharing.isAvailableAsync).not.toHaveBeenCalled();
});

it.each([
  ['library.csv', 'text/csv;charset=utf-8', 'public.comma-separated-values-text'],
  ['notes.md', 'text/markdown;charset=utf-8', 'net.daringfireball.markdown'],
  ['notes.pdf', 'application/pdf', 'com.adobe.pdf'],
])('writes and shares %s using its exact name, UTF-8 contents and type, then retains it', async (fileName, mimeType, UTI) => {
  const uri = `${attemptDirectory}${fileName}`;
  await expect(deliverTextFile({ fileName, mimeType, text: textFile.text })).resolves.toBe('shared');
  expect(sharing.isAvailableAsync).toHaveBeenCalledTimes(1);
  expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(attemptDirectory, { intermediates: true });
  expect(fs.writeAsStringAsync).toHaveBeenCalledWith(uri, textFile.text, { encoding: 'utf8' });
  expect(sharing.shareAsync).toHaveBeenCalledWith(uri, { mimeType, dialogTitle: fileName, UTI });
  expect(fs.deleteAsync).toHaveBeenCalledTimes(0);
  expect(fs.deleteAsync).not.toHaveBeenCalledWith(uri, { idempotent: true });
  expectCleanup();
  expect(sharing.isAvailableAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.makeDirectoryAsync.mock.invocationCallOrder[0]);
  expect(fs.makeDirectoryAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.writeAsStringAsync.mock.invocationCallOrder[0]);
  expect(fs.writeAsStringAsync.mock.invocationCallOrder[0]).toBeLessThan(sharing.shareAsync.mock.invocationCallOrder[0]);
});

it('retains a text file during and after the share sheet settles, including dismissal', async () => {
  let dismiss!: () => void;
  sharing.shareAsync.mockImplementationOnce(() => new Promise<void>(resolve => { dismiss = resolve; }));
  const pending = deliverTextFile(textFile).catch(error => error);
  for (let n = 0; n < 8; n++) await Promise.resolve();
  expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
  expect(fs.deleteAsync).not.toHaveBeenCalled();
  dismiss();
  await expect(pending).resolves.toBe('shared');
  expect(fs.deleteAsync).not.toHaveBeenCalledWith(namedText, { idempotent: true });
  expectCleanup();
});

it.each([false, true])('deletes a text file after a share error and preserves that error (delete fails=%s)', async deleteFails => {
  const error = new Error('share failed');
  sharing.shareAsync.mockRejectedValueOnce(error);
  if (deleteFails) fs.deleteAsync.mockRejectedValue(new Error('cleanup failed'));
  await expect(deliverTextFile(textFile)).rejects.toBe(error);
  expect(fs.deleteAsync).toHaveBeenCalledWith(namedText, { idempotent: true });
  expectCleanup(namedText, attemptDirectory);
});

it.each([namedText, attemptDirectory])('retains a successful text export when deleting %s would fail', async failedUri => {
  fs.deleteAsync.mockImplementation(async uri => { if (uri === failedUri) throw new Error('cleanup failed'); });
  await expect(deliverTextFile(textFile)).resolves.toBe('shared');
  expect(fs.deleteAsync).not.toHaveBeenCalledWith(namedText, { idempotent: true });
  expectCleanup();
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
  expect(fs.readDirectoryAsync).not.toHaveBeenCalled(); expect(fs.deleteAsync).not.toHaveBeenCalled();
  expect(fs.makeDirectoryAsync).not.toHaveBeenCalled(); expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  expect(print.printToFileAsync).not.toHaveBeenCalled(); expect(sharing.shareAsync).not.toHaveBeenCalled();
});

it.each(['text', 'pdf'] as const)('rejects %s delivery when there is no cache directory', async kind => {
  mockCacheDirectory = null;
  await expect(kind === 'text' ? deliverTextFile(textFile) : deliverPdfFile(pdfFile)).rejects.toBeInstanceOf(ExportUnavailableError);
  expect(fs.makeDirectoryAsync).not.toHaveBeenCalled(); expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  expect(print.printToFileAsync).not.toHaveBeenCalled(); expect(fs.moveAsync).not.toHaveBeenCalled();
  expect(sharing.shareAsync).not.toHaveBeenCalled(); expect(fs.deleteAsync).not.toHaveBeenCalled();
  expect(fs.readDirectoryAsync).not.toHaveBeenCalled();
});

it('rechecks share availability for every delivery', async () => {
  await deliverTextFile(textFile);
  sharing.isAvailableAsync.mockResolvedValueOnce(false);
  await expect(deliverPdfFile(pdfFile)).rejects.toBeInstanceOf(ExportUnavailableError);
  expect(sharing.isAvailableAsync).toHaveBeenCalledTimes(2);
  expect(print.printToFileAsync).not.toHaveBeenCalled();
});

it('prints HTML, moves and shares the named PDF, then deletes only the original print path', async () => {
  await expect(deliverPdfFile(pdfFile)).resolves.toBe('shared');
  expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(attemptDirectory, { intermediates: true });
  expect(print.printToFileAsync).toHaveBeenCalledWith({ html: pdfFile.html });
  expect(fs.moveAsync).toHaveBeenCalledWith({ from: printedPdf, to: namedPdf });
  expect(sharing.shareAsync).toHaveBeenCalledWith(namedPdf, {
    mimeType: 'application/pdf', dialogTitle: 'notes-walden.pdf', UTI: 'com.adobe.pdf',
  });
  expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
  expect(fs.deleteAsync).toHaveBeenCalledWith(printedPdf, { idempotent: true });
  expect(fs.deleteAsync).not.toHaveBeenCalledWith(namedPdf, { idempotent: true });
  expectCleanup(printedPdf);
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
    expectCleanup(printedPdf);
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

it('retains the PDF during and after sharing settles', async () => {
  let dismiss!: () => void;
  sharing.shareAsync.mockImplementationOnce(() => new Promise<void>(resolve => { dismiss = resolve; }));
  const pending = deliverPdfFile(pdfFile).catch(error => error);
  for (let n = 0; n < 8; n++) await Promise.resolve();
  expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
  expect(fs.deleteAsync).not.toHaveBeenCalled();
  dismiss();
  await expect(pending).resolves.toBe('shared');
  expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
  expectCleanup(printedPdf);
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

it.each([printedPdf, namedPdf, attemptDirectory])('deletes only the original print path and preserves success when deleting %s would fail', async failedUri => {
  fs.deleteAsync.mockImplementation(async uri => { if (uri === failedUri) throw new Error('cleanup failed'); });
  await expect(deliverPdfFile(pdfFile)).resolves.toBe('shared');
  expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
  expect(fs.deleteAsync).toHaveBeenCalledWith(printedPdf, { idempotent: true });
  expect(fs.deleteAsync).not.toHaveBeenCalledWith(namedPdf, { idempotent: true });
  expectCleanup(printedPdf);
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
    expectCleanup();
  } else {
    expect(fs.moveAsync.mock.calls).toEqual([
      [{ from: printedPdf, to: firstUri }], [{ from: secondPrintedPdf, to: secondUri }],
    ]);
    expectCleanup(secondPrintedPdf);
  }
  dismiss();
  await expect(pending).resolves.toBe('shared');
  expectCleanup(...(kind === 'text' ? [] : [secondPrintedPdf, printedPdf]));
});

it('keeps the web-only prepared-print API unavailable on native', () => {
  expect(() => preparePdf(pdfFile)).toThrow(ExportUnavailableError);
  const prepared = { print: jest.fn(), dispose: jest.fn() };
  expect(() => printPreparedPdf(prepared)).toThrow(ExportUnavailableError);
  expect(() => disposePreparedPdf(prepared)).toThrow(ExportUnavailableError);
});

describe('export retention sweep', () => {
  const root = 'file:///cache/exports/';
  const newDirectory = `${root}12kw0-i/`;
  const image = { fileName: 'quote.png', sourceUri: 'file:///cache/captured.png' };
  function deliver(kind: 'text' | 'pdf' | 'image') {
    if (kind === 'text') return deliverTextFile(textFile);
    if (kind === 'pdf') return deliverPdfFile(pdfFile);
    return deliverImageFile(image);
  }
  function tempFiles(kind: 'text' | 'pdf' | 'image') {
    return kind === 'text' ? [] : [kind === 'pdf' ? printedPdf : image.sourceUri];
  }
  beforeEach(() => { jest.mocked(Date.now).mockReturnValue(1_800_000); });

  it.each(['text', 'pdf', 'image'] as const)('sweeps old and invalid folders before creating a new %s attempt, keeping fresh folders', async kind => {
    // At 30 minutes: these timestamps are 19 and 28 minutes after the epoch.
    fs.readDirectoryAsync.mockResolvedValue(['ofmo-old', '100ao-fresh', 'garbage']);
    await expect(deliver(kind)).resolves.toBe('shared');
    expect(fs.readDirectoryAsync).toHaveBeenCalledTimes(1);
    expect(fs.readDirectoryAsync).toHaveBeenCalledWith(root);
    expectCleanup(`${root}ofmo-old`, `${root}garbage`, ...tempFiles(kind));
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(newDirectory, { intermediates: true });
    expect(sharing.isAvailableAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.readDirectoryAsync.mock.invocationCallOrder[0]);
    expect(fs.readDirectoryAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.deleteAsync.mock.invocationCallOrder[0]);
    expect(fs.deleteAsync.mock.invocationCallOrder[1]).toBeLessThan(fs.makeDirectoryAsync.mock.invocationCallOrder[0]);
  });

  it('deletes an entry exactly ten minutes old', async () => {
    fs.readDirectoryAsync.mockResolvedValue(['ppxc-boundary']); // Timestamp: 1,200,000 ms.
    await expect(deliverTextFile(textFile)).resolves.toBe('shared');
    expect(EXPORT_RETENTION_MS).toBe(10 * 60 * 1000);
    expectCleanup(`${root}ppxc-boundary`);
    expect(fs.deleteAsync.mock.invocationCallOrder[0]).toBeLessThan(fs.makeDirectoryAsync.mock.invocationCallOrder[0]);
  });

  it('deletes entries whose timestamp is unparseable or non-finite', async () => {
    const overflow = `${'z'.repeat(300)}-overflow`;
    fs.readDirectoryAsync.mockResolvedValue(['!-invalid', overflow]);
    await expect(deliverTextFile(textFile)).resolves.toBe('shared');
    expectCleanup(`${root}!-invalid`, `${root}${overflow}`);
  });

  it.each([
    [11, true],
    [1, false],
    [10, false],
  ])('sweeps a folder %s minutes in the future only beyond retention', async (minutesAhead, shouldDelete) => {
    const entry = `${(1_800_000 + minutesAhead * 60_000).toString(36)}-future`;
    fs.readDirectoryAsync.mockResolvedValue([entry]);
    await expect(deliverTextFile(textFile)).resolves.toBe('shared');
    expectCleanup(...(shouldDelete ? [`${root}${entry}`] : []));
  });

  it('waits for the sweep deletion to settle before creating the attempt directory', async () => {
    let finishDelete!: () => void;
    let deleteStarted!: () => void;
    const started = new Promise<void>(resolve => { deleteStarted = resolve; });
    fs.readDirectoryAsync.mockResolvedValue(['ofmo-old']);
    fs.deleteAsync.mockImplementationOnce(() => {
      deleteStarted();
      return new Promise<void>(resolve => { finishDelete = resolve; });
    });
    const pending = deliverTextFile(textFile);
    await started;
    expect(fs.makeDirectoryAsync).not.toHaveBeenCalled();
    expect(sharing.shareAsync).not.toHaveBeenCalled();
    finishDelete();
    await expect(pending).resolves.toBe('shared');
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(newDirectory, { intermediates: true });
    expectCleanup(`${root}ofmo-old`);
  });

  it.each(['text', 'pdf', 'image'] as const)('still shares %s when the export folder cannot be read', async kind => {
    fs.readDirectoryAsync.mockRejectedValueOnce(new Error('folder missing'));
    await expect(deliver(kind)).resolves.toBe('shared');
    expect(fs.readDirectoryAsync).toHaveBeenCalledWith(root);
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(newDirectory, { intermediates: true });
    expectCleanup(...tempFiles(kind));
  });

  it.each(['text', 'pdf', 'image'] as const)('continues the sweep and shares %s when deleting an old folder fails', async kind => {
    fs.readDirectoryAsync.mockResolvedValue(['ofmo-old', '100ao-fresh', 'garbage']);
    fs.deleteAsync.mockRejectedValueOnce(new Error('sweep delete failed'));
    await expect(deliver(kind)).resolves.toBe('shared');
    expectCleanup(`${root}ofmo-old`, `${root}garbage`, ...tempFiles(kind));
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(newDirectory, { intermediates: true });
    expect(fs.deleteAsync.mock.invocationCallOrder[1]).toBeLessThan(fs.makeDirectoryAsync.mock.invocationCallOrder[0]);
  });
});

it.each(['text', 'pdf', 'image'] as const)('cleans the %s attempt if native file creation throws synchronously after the directory exists', async kind => {
  const error = new Error('native creation failed');
  const fail = () => { throw error; };
  if (kind === 'text') fs.writeAsStringAsync.mockImplementationOnce(fail);
  if (kind === 'pdf') print.printToFileAsync.mockImplementationOnce(fail);
  if (kind === 'image') fs.moveAsync.mockImplementationOnce(fail);
  const image = { fileName: 'quote.png', sourceUri: 'file:///cache/captured.png' };
  const pending = kind === 'text' ? deliverTextFile(textFile) : kind === 'pdf' ? deliverPdfFile(pdfFile) : deliverImageFile(image);
  await expect(pending).rejects.toBe(error);
  expect(fs.makeDirectoryAsync).toHaveBeenCalledWith(attemptDirectory, { intermediates: true });
  expect(sharing.shareAsync).not.toHaveBeenCalled();
  const uri = kind === 'text' ? namedText : kind === 'pdf' ? namedPdf : `${attemptDirectory}${image.fileName}`;
  expectCleanup(uri, ...(kind === 'image' ? [image.sourceUri] : []), attemptDirectory);
});
