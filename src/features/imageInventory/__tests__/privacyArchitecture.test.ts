import fs from 'fs';
import path from 'path';

describe('Phase 9 Unit 6B frontend privacy architecture', () => {
    const root = path.join(process.cwd(), 'src/features/imageInventory');
    const runtimeSources = () => fs.readdirSync(root, { recursive: true })
        .filter((name) => /\.(ts|tsx)$/u.test(String(name)) && !String(name).includes('__tests__'))
        .map((name) => fs.readFileSync(path.join(root, String(name)), 'utf8'))
        .join('\n');

    it('does not persist private queries or create an offline mutation queue', () => {
        expect(runtimeSources()).not.toMatch(
            /AsyncStorage|MMKV|PersistQueryClient|persistQueryClient|offlineMutation|mutationQueue/u,
        );
    });

    it('does not read Supabase tables directly or introduce Unit 7 operations', () => {
        expect(runtimeSources()).not.toMatch(/supabase\s*\.\s*from\s*\(/u);
        expect(runtimeSources()).not.toMatch(
            /phase9_commit_candidate|commit_candidate|publish_candidate|inventory_commit/u,
        );
    });
});
