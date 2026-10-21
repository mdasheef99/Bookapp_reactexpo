export const PASSAGE_CARD_REFERENCE_WIDTH = 360;
export const PASSAGE_CARD_ASPECT = 1350 / 1080;
export const PASSAGE_CARD_PIXELS = { width: 1080, height: 1350 };
export const PASSAGE_CARD_MAX_GROUPS = 380;

export interface PassageCardFit { text: string; fontSize: number; lineHeight: number; shortened: boolean }

/** Cut only whole base-and-mark groups, then leave room for the truncation tail. */
export function truncateToVisible(text: string, visiblePrefix: string): string {
  const groups = text.match(/\P{M}\p{M}*|\p{M}+/gu) ?? [];
  const kept: string[] = [];
  let length = 0;
  for (const group of groups) {
    if (length + group.length > visiblePrefix.length) break;
    kept.push(group);
    length += group.length;
  }
  for (let index = kept.length - 1; index >= Math.max(0, kept.length - 40); index--) {
    if (/\s/u.test(kept[index])) { kept.length = index; break; }
  }
  return kept.join('').replace(/[\s.,;:!?–—…-]+$/u, '') + '…';
}

export function passageCardLayout(content: string): PassageCardFit {
  const text = content.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const groups = text.match(/\P{M}\p{M}*|\p{M}+/gu) ?? [];
  const weight = (group: string) => group.startsWith('\n') ? 30 : 1;
  const size = groups.reduce((total, group) => total + weight(group), 0);
  const [fontSize, lineHeight] = size <= 120 ? [26, 36] : size <= 240 ? [22, 31] : [18, 26];
  const shortened = size > PASSAGE_CARD_MAX_GROUPS;
  if (!shortened) return { text, fontSize, lineHeight, shortened };

  const kept: string[] = [];
  let measured = 0;
  for (const group of groups) {
    if (measured + weight(group) > PASSAGE_CARD_MAX_GROUPS - 1) break;
    kept.push(group);
    measured += weight(group);
  }
  for (let index = kept.length - 1; index >= Math.max(0, kept.length - 40); index--) {
    if (/\s/u.test(kept[index])) { kept.length = index; break; }
  }
  return { text: kept.join('').replace(/[\s.,;:!?–—…-]+$/u, '') + '…', fontSize, lineHeight, shortened };
}
