# Book-section ESLint checks

These local CommonJS rules run over the existing `lint:library` scope.
They warn by default; migrated files can opt into errors through `STRICT_FILES`.

- `no-raw-style-values` (DP-02): flags literal hex/rgb/hsl colours and numeric
  font size, line height, and spacing values. Spacing 0/1 (including negatives)
  is allowed. Use appearance, typography, and spacing tokens instead.
- `require-accessible-name` (DP-06): checks Pressable, TouchableOpacity,
  TextInput, and BookButton, including member names such as Animated.Pressable.
  Labels, direct Text children, spreads, or `accessible={false}` satisfy it.
- `no-fabricated-ratings` (DP-04): flags literal stars with digits, parenthesized
  review/rating counts, and literal scores out of five.

Known gaps: named CSS colours and `transparent` are not flagged. Colour templates
with expressions are skipped. Numeric checks do not evaluate calls, multiplication,
division, arrays, nested values, or non-font/non-spacing geometry. Accessibility
checks trust dynamic labels and spreads, do not resolve aliases or wrappers, and
do not verify Text content. Rating checks inspect each literal/quasi separately;
bare stars without digits (e.g. `★★★★★`) and split data-driven text are allowed.
Colour/rating literals in TS type positions (`type C = '#fff'`) are skipped; values under
`as`, `satisfies` or `!` are still checked.
These syntax checks do not replace visual or accessibility review.

To migrate a file, resolve its three rule findings, then add its repo-relative
forward-slash path to `STRICT_FILES` in `config.js`. Tests check listed paths exist.
Strict paths stay plain for filesystem checks; config escapes glob metacharacters
so routes such as `app/(tabs)/library/[bookId].tsx` receive errors in the real config.
The raw-value allow-list covers reviewed shelf materials/geometry and token modules;
it disables only DP-02. Allow-list changes require reviewer sign-off and an explicit
update to the exact-list assertion in `__tests__/config.test.js`.

Run `npx jest --runInBand eslint-rules` to check rules, config, and the ratchet.
The ratchet spawns ESLint over the same four paths as `package.json`'s `lint:library`;
keep those paths in sync. `ratchet-baseline.json` records warnings per rule.
Counts may fall without failing. Lower the baseline after improvements; raising
any count requires reviewer sign-off. Never auto-regenerate it to hide regressions.
Existing non-book-section lint errors do not invalidate warning measurement.
