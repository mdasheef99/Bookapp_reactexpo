import { isHiddenFromAccessibility } from '@testing-library/react-native';
import type { RenderResult } from '@testing-library/react-native';

import { BookButton } from '@/components/library/ui';

/** Anything with `UNSAFE_queryAllByType`: a `render()` result or the global `screen`. */
export type BookSectionScreen = Pick<RenderResult, 'UNSAFE_queryAllByType'>;

/** `allow: 2` is only for the composer `choose` step (Write and Scan have equal weight by decision). */
export interface ExpectSinglePrimaryOptions {
  allow?: 2;
}

/**
 * DP-03 requires exactly one primary-styled button visible per screen state.
 * Counts rendered `BookButton` elements whose `variant` prop is `'primary'`,
 * excluding ones hidden from accessibility. The composer `choose` step is the
 * only `allow: 2` user (via `expectSinglePrimary`).
 */
export function countPrimaryButtons(screen: BookSectionScreen): number {
  return getVisiblePrimaries(screen).length;
}

/**
 * DP-03 requires exactly one primary-styled button visible per screen state.
 * Passes only when the visible primary count equals `options?.allow ?? 1`.
 * The composer `choose` step is the only `allow: 2` user.
 */
export function expectSinglePrimary(screen: BookSectionScreen, options?: ExpectSinglePrimaryOptions): void {
  const expected = options?.allow ?? 1;
  const primaries = getVisiblePrimaries(screen);
  const n = primaries.length;
  if (n === expected) {
    return;
  }
  const labels = n === 0 ? 'none' : primaries.map(instance => `"${String(instance.props.label)}"`).join(', ');
  let message = `DP-03: expected exactly ${expected} primary BookButton(s) but found ${n}: ${labels}`;
  if (n > expected) {
    message += ' Make the others variant="secondary", "text" or "destructive".';
  } else {
    message += ' A state with no primary action needs one, or should not call this helper.';
  }
  throw new Error(message);
}

function getVisiblePrimaries(screen: BookSectionScreen) {
  const all = screen.UNSAFE_queryAllByType(BookButton);
  return all.filter(instance => {
    if (instance.props.variant !== 'primary') {
      return false;
    }
    return !isHiddenFromAccessibility(instance);
  });
}
