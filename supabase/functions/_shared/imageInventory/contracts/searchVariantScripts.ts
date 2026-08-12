import {
  Phase9ContractError,
  requiredString,
} from '../domain/validation.ts';

const SCRIPT_PATTERNS = {
  Latn: /\p{Script=Latin}/gu,
  Knda: /\p{Script=Kannada}/gu,
  Taml: /\p{Script=Tamil}/gu,
  Telu: /\p{Script=Telugu}/gu,
  Mlym: /\p{Script=Malayalam}/gu,
  Deva: /\p{Script=Devanagari}/gu,
  Arab: /\p{Script=Arabic}/gu,
  Mtei: /\p{Script=Meetei_Mayek}/gu,
} as const;

export type SupportedSearchVariantScript = keyof typeof SCRIPT_PATTERNS;

const SOURCE_LANGUAGE_SCRIPTS:
Readonly<Record<string, SupportedSearchVariantScript>> = {
  en: 'Latn',
  kn: 'Knda',
  ta: 'Taml',
  te: 'Telu',
  ml: 'Mlym',
  hi: 'Deva',
  ur: 'Arab',
  mni: 'Mtei',
};

export function parseSupportedSearchVariantScript(
  value: unknown,
  field: string,
): SupportedSearchVariantScript {
  const parsed = requiredString(value, field, 4, {
    activeContent: false,
    pattern: /^[A-Z][a-z]{3}$/u,
  });
  if (!Object.prototype.hasOwnProperty.call(SCRIPT_PATTERNS, parsed)) {
    throw new Phase9ContractError(field, 'unsupported ISO 15924 script');
  }
  return parsed as SupportedSearchVariantScript;
}

export function textUsesScript(
  text: string,
  expected: SupportedSearchVariantScript,
): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return false;
  const expectedLetters = text.match(SCRIPT_PATTERNS[expected]) ?? [];
  return expectedLetters.length / letters.length >= 0.6;
}

export function assertLanguageScriptCoherence(
  language: string,
  script: SupportedSearchVariantScript,
  field: string,
): void {
  const explicitScript = language.split('-').slice(1)
    .find((part) => /^[A-Z][a-z]{3}$/u.test(part));
  if (explicitScript && explicitScript !== script) {
    throw new Phase9ContractError(field, 'language tag and script conflict');
  }
}

export function assertSourceLanguageScript(
  text: string,
  language: string,
  script: SupportedSearchVariantScript,
  field: string,
): void {
  assertLanguageScriptCoherence(language, script, field);
  const expected = SOURCE_LANGUAGE_SCRIPTS[language.split('-')[0]];
  if (expected && script !== expected && script !== 'Latn') {
    throw new Phase9ContractError(field, 'language and script conflict');
  }
  if (!textUsesScript(text, script)) {
    throw new Phase9ContractError(field, 'text and script conflict');
  }
}
