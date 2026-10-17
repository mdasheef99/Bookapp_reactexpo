import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NoteEditor } from '../NoteEditor';
import { setAuthState } from '@/features/auth/store/authStore';
import { ocrService } from '@/features/books/services/ocrService';
import * as ImageManipulator from 'expo-image-manipulator';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
jest.mock('@/features/books/services/userBookPagesService', () => ({ userBookPagesService: { upsertPage: jest.fn(async () => ({})) } }));
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-blur', () => ({ BlurView: 'View' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { appOwnership: 'standalone', executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '92000000-0000-4000-8000-000000000001' }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: { bgPrimary:'#fff', bgSecondary:'#eee', border:'#ccc', accent:'#123', textPrimary:'#111',textSecondary:'#444',textTertiary:'#777' } }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })), launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: '/image.jpg', width: 800, height: 1200 }] })) }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(async () => ({ base64: '/9j/AAAA' })), SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('@/features/books/services/ocrService', () => ({ ...jest.requireActual('@/features/books/services/ocrService'), ocrService: { recognizePageText: jest.fn(), recognizePageViaCloud: jest.fn() } }));
const local = ocrService.recognizePageText as jest.Mock;
const cloud = ocrService.recognizePageViaCloud as jest.Mock;
const props = { visible:true, onClose:jest.fn(), onSave:jest.fn(async () => {}), userId:'reader-a', userBookId:'book-a' };
let alerts: jest.SpyInstance;
beforeEach(() => {
 jest.clearAllMocks(); alerts = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
 setAuthState({ session:{ user:{ id:'reader-a' } } as any,status:'authenticated',initializationError:null });
 local.mockResolvedValue({ version:1,provider:'on-device',languageHint:'en',reviewText:'local passage',reviewOverflow:false });
});
afterEach(() => alerts.mockRestore());

it.each([null, 'question'] as const)('preserves a saved %s category when the retained editor saves unchanged text', async tag => {
 const saved = { id:'note', user_id:'reader-a', user_book_id:'book-a', content:'Saved body', tag, page_number:null, created_at:'2026-10-10T12:00:00Z', updated_at:'2026-10-10T12:00:00Z' };
 const screen = render(<NoteEditor {...props} editingNote={saved as any} />);
 expect(screen.getByLabelText('Note text').props.value).toBe('Saved body');
 fireEvent.press(screen.getByText('Save'));
 await waitFor(() => expect(props.onSave).toHaveBeenCalledWith('Saved body', tag, undefined));
});
it('discloses character overflow and prevents an incomplete one-word note save', () => {
 const screen = render(<NoteEditor {...props} initialOcrText={'x'.repeat(20001)} />);
 expect(screen.getByText(/first 20,000 characters/)).toBeTruthy();
 fireEvent.press(screen.getByText('Save'));
 expect(props.onSave).not.toHaveBeenCalled();
});
it('requires explicit partial-text acceptance after editing and ignores stale acceptance', async () => {
 const screen = render(<NoteEditor {...props} initialOcrText={'x'.repeat(20001)} />);
 fireEvent.changeText(screen.getByLabelText('Note text'), 'short passage');
 fireEvent.press(screen.getByLabelText('Use partial OCR text'));
 const accept = (alerts.mock.calls.at(-1)![2] as any[])[1].onPress;
 fireEvent.changeText(screen.getByLabelText('Note text'), 'revised passage');
 act(() => accept());
 fireEvent.press(screen.getByText('Save'));
 expect(props.onSave).not.toHaveBeenCalled();
 fireEvent.press(screen.getByLabelText('Use partial OCR text'));
 act(() => (alerts.mock.calls.at(-1)![2] as any[])[1].onPress());
 expect(props.onSave).not.toHaveBeenCalled();
 fireEvent.press(screen.getByText('Save'));
 await waitFor(() => expect(props.onSave).toHaveBeenCalledWith('revised passage', 'quote', undefined));
});
it('preserves 600-word extraction for editing instead of taking first 500', () => {
 const text = Array(600).fill('word').join(' '); const screen = render(<NoteEditor {...props} initialOcrText={text} />);
 expect(screen.getByLabelText('Note text').props.value).toBe(text);
 expect(screen.getByText(/choose a shorter passage to save a note/)).toBeTruthy();
});
it('blocks vault saves until partial review acceptance and preserves destination limits', async () => {
 const screen = render(<NoteEditor {...props} initialOcrText={'x'.repeat(20001)} />);
 fireEvent.changeText(screen.getByPlaceholderText('e.g. 42'), '5');
 fireEvent.changeText(screen.getByLabelText('Note text'), 'short passage');
 fireEvent.press(screen.getByLabelText('Save to Vault'));
 expect(userBookPagesService.upsertPage).not.toHaveBeenCalled();
 fireEvent.press(screen.getByLabelText('Use partial OCR text'));
 act(() => (alerts.mock.calls.at(-1)![2] as any[])[1].onPress());
 fireEvent.changeText(screen.getByLabelText('Note text'), 'x'.repeat(4001));
 fireEvent.press(screen.getByLabelText('Use partial OCR text'));
 act(() => (alerts.mock.calls.at(-1)![2] as any[])[1].onPress());
 expect(screen.getByLabelText('Save to Vault').props.accessibilityState.disabled).toBe(true);
 fireEvent.changeText(screen.getByLabelText('Note text'), 'short passage');
 fireEvent.press(screen.getByLabelText('Use partial OCR text'));
 act(() => (alerts.mock.calls.at(-1)![2] as any[])[1].onPress());
 fireEvent.press(screen.getByLabelText('Save to Vault'));
 await waitFor(() => expect(userBookPagesService.upsertPage).toHaveBeenCalledWith('reader-a','book-a',5,'short passage'));
});
it('partial acceptance does not bypass the note word limit', () => {
 const screen = render(<NoteEditor {...props} initialOcrText={'x'.repeat(20001)} />);
 fireEvent.changeText(screen.getByLabelText('Note text'), Array(501).fill('word').join(' '));
 fireEvent.press(screen.getByLabelText('Use partial OCR text'));
 act(() => (alerts.mock.calls.at(-1)![2] as any[])[1].onPress());
 fireEvent.press(screen.getByText('Save'));
 expect(props.onSave).not.toHaveBeenCalled();
});
it('scans locally without uploading and does not enlarge a small photo', async () => {
 const screen = render(<NoteEditor {...props} />); fireEvent.press(screen.getByLabelText('Scan page'));
 await waitFor(() => expect(screen.getByLabelText('Note text').props.value).toBe('local passage'));
 expect(cloud).not.toHaveBeenCalled(); expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith('/image.jpg', [], expect.anything());
});
it('cloud requires explicit confirmation; cancel does not transmit', async () => {
 const screen = render(<NoteEditor {...props} />); fireEvent.press(screen.getByLabelText('Scan page'));
 await waitFor(() => expect(screen.getByLabelText('Note text').props.value).toBe('local passage'));
 fireEvent.press(screen.getByLabelText('Retry with cloud'));
 expect(alerts).toHaveBeenLastCalledWith('Recognize with cloud?', expect.stringContaining('Google Cloud Vision'), expect.any(Array));
 expect(cloud).not.toHaveBeenCalled();
});
it('keeps valid local text after cloud failure without exposing raw error', async () => {
 cloud.mockRejectedValue(new Error('secret provider error'));
 const screen = render(<NoteEditor {...props} />); fireEvent.press(screen.getByLabelText('Scan page'));
 await waitFor(() => expect(screen.getByLabelText('Note text').props.value).toBe('local passage'));
 fireEvent.press(screen.getByLabelText('Retry with cloud'));
 const confirm = (alerts.mock.calls.at(-1)![2] as any[])[1].onPress;
 await act(async () => { await confirm(); });
 expect(screen.getByLabelText('Note text').props.value).toBe('local passage');
 expect(cloud).toHaveBeenCalledWith(expect.objectContaining({ consent:true,userId:'reader-a',imageBase64:'/9j/AAAA' }));
 expect(JSON.stringify(alerts.mock.calls)).not.toContain('secret provider');
});
it('ignores result after close while native extraction is pending', async () => {
 let resolve!: (v: unknown) => void; local.mockImplementation(() => new Promise(r => { resolve = r; }));
 const screen = render(<NoteEditor {...props} />); fireEvent.press(screen.getByLabelText('Scan page'));
 await waitFor(() => expect(local).toHaveBeenCalled()); fireEvent.press(screen.getByText('Cancel'));
 await act(async () => { resolve({ reviewText:'late private text',reviewOverflow:false }); });
 expect(screen.getByLabelText('Note text').props.value).toBe(''); expect(props.onClose).toHaveBeenCalled();
});
it('invalidates the image and ignores output on logout', async () => {
 let resolve!: (v: unknown) => void; local.mockImplementation(() => new Promise(r => { resolve = r; }));
 const screen = render(<NoteEditor {...props} />); fireEvent.press(screen.getByLabelText('Scan page'));
 await waitFor(() => expect(local).toHaveBeenCalled());
 await act(async () => { setAuthState({session:null,status:'unauthenticated',initializationError:null}); resolve({reviewText:'late',reviewOverflow:false}); });
 expect(screen.getByLabelText('Note text').props.value).toBe(''); expect(screen.queryByLabelText('Retry with cloud')).toBeNull();
});
