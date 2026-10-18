import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { PROTOTYPE_PAIRS } from '../prototypeTokens';

const root = path.resolve(__dirname, '../../../..');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : /\.[jt]sx?$/.test(file) ? [file] : [];
});
const prototypeFiles = walk(path.join(root, 'src/prototypes/flowA'));
const sourceFiles = prototypeFiles.filter(file => !file.includes('__tests__'));

it('uses only registered foreground/background pairs, parsed from the unexported FU-1a registry', () => {
    const source = fs.readFileSync(path.join(root, 'src/components/library/__tests__/LibraryAppearance.test.ts'), 'utf8');
    const registry = source.match(/const BOOK_TOKEN_PAIRS[^=]*=\s*\[([\s\S]*?)\];/)![1];
    const pairs = [...registry.matchAll(/token:\s*'([^']+)',\s*background:\s*'([^']+)'/g)]
        .map(([, token, background]) => `${token}/${background}`);
    expect(pairs.length).toBeGreaterThan(0);
    for (const { token, background } of PROTOTYPE_PAIRS) expect(pairs).toContain(`${token}/${background}`);
});

it('has no raw colours, numeric typography/spacing outside the mirror, fabricated scores or features', () => {
    for (const file of prototypeFiles) {
        const source = fs.readFileSync(file, 'utf8');
        expect({ file, matches: source.match(/#[\da-f]{3,8}\b|\brgba?\(\s*\d/gi) ?? [] }).toEqual({ file, matches: [] });
        if (!file.endsWith('prototypeTokens.ts')) {
            expect({ file, matches: source.match(/\b(?:fontSize|lineHeight|margin\w*|padding\w*|gap)\s*:\s*\d+/g) ?? [] }).toEqual({ file, matches: [] });
        }
        expect(source).not.toContain(String.fromCodePoint(9733));
        expect(source).not.toMatch(/\breviews\s*\(/i);
        expect(source).not.toMatch(/\b(?:len[d]|Available for Len[d]ing)\b/i);
        expect(source).not.toMatch(/(?:Your rating:|rating)\s*\d/i);
        // Note dates intentionally compare with the current local calendar year.
        if (file !== path.join(root, 'src/prototypes/flowA/components/NotePassages.tsx')) {
            expect(source).not.toMatch(/Date\.now\(|new Date\(\s*\)/);
        }
    }
});

it('does not import runtime data, persistence or navigation into the prototype', () => {
    for (const file of sourceFiles) {
        const source = fs.readFileSync(file, 'utf8');
        const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        for (const statement of ast.statements) {
            if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) {
                expect((statement.moduleSpecifier as ts.StringLiteral).text)
                    .not.toMatch(/supabase|@tanstack\/react-query|\/services\/|\/gateway|useAuth|AsyncStorage/);
            }
        }
        expect(source).not.toMatch(/router\.(?:push|replace)|\brequire\([^)]*(?:services|supabase|AsyncStorage)/);
    }
});

it('keeps the dev guard as the only production import of prototype code', () => {
    const allowed = path.join(root, 'app/(tabs)/library/dev-flow-a.tsx');
    const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'src'))]
        .filter(file => !file.includes(`${path.sep}prototypes${path.sep}`) && file !== allowed);
    for (const file of files) {
        expect({ file, imports: fs.readFileSync(file, 'utf8').match(/(?:from\s*|import\s*|require\s*\()\s*['"][^'"]*prototypes\//g) ?? [] })
            .toEqual({ file, imports: [] });
    }
    const guard = fs.readFileSync(allowed, 'utf8');
    expect(guard).toMatch(/__DEV__\s*\?\s*require\(/);
    expect(guard).toContain('<Redirect href="/(tabs)/library" />');
    expect(fs.readFileSync(path.join(root, 'src/prototypes/flowA/BookDetailsPrototypeRoute.tsx'), 'utf8'))
        .toContain('FA_P1_PROTOTYPE_MARKER');
});
