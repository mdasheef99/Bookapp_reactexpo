export {
  READ_OUTCOMES,
  effectiveReadDates,
  historyKeys,
  ReadingHistoryError,
  toLocalDay,
} from './readingHistoryContract';
export type {
  ReadDateEdges,
  ReadingGoal,
  ReadingProgressEntry,
  ReadingRead,
  ReadingSettings,
  ReadOutcome,
} from './readingHistoryContract';
export { readingHistoryGateway } from './readingHistoryGateway';
export type {
  OpenReadWithProgress,
  ProgressValue,
  ReadDatesPatch,
  YearQuoteRow,
} from './readingHistoryGateway';
export {
  allTimeStats,
  averageDaysPerBook,
  booksFinished,
  countingFinishedEndsInYear,
  countingFinishedReads,
  countingRateReads,
  distinctFinishedBookIdsInYear,
  finishRate,
  monthlyFinishedReads,
  pagesRead,
  quotesOfYear,
  yearBooksFinishedCount,
  yearCardTitle,
  yearStats,
} from './readingStats';
export type { AllTimeStats, FinishedEnd, PagesRead, YearQuote, YearStats } from './readingStats';
export { useLeaveOutStats } from './useLeaveOutStats';
export { useReadingGoal } from './useReadingGoal';
export { useReadingStats } from './useReadingStats';
export { readingSlotText } from './readingSlotText';
export { assignNotesToReads, nthBookCount, ordinal } from './readingTimeline';
export type { AssignedNotes, ReadWindow } from './readingTimeline';
export { useBookReadingHistory } from './useBookReadingHistory';
export { useStartReading } from './useStartReading';
export { useOpenReadBookIds } from './useOpenReadBookIds';
export { useOpenReadsWithProgress } from './useOpenReadsWithProgress';
export { useReadProgress } from './useReadProgress';
export {
  currentPosition,
  dailyPages,
  estimateRemaining,
  formatDailyPagesSummary,
  formatProgressText,
  percentComplete,
  resolveEntryPages,
} from './progressMath';
export type { DailyPagesDay, DailyPagesResult, ProgressEstimate, ProgressPosition } from './progressMath';
