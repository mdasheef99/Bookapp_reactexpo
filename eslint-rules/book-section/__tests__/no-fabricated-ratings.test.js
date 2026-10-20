const { RuleTester } = require('eslint');
const rule = require('../no-fabricated-ratings');

const tester = new RuleTester({
    languageOptions: {
        parser: require('@typescript-eslint/parser'),
        parserOptions: { ecmaFeatures: { jsx: true } },
    },
});

tester.run('no-fabricated-ratings', rule, {
    valid: [
        '`${rating} / 5`;',
        '<Text>{review.averageRating}</Text>',
        "'★'.repeat(n);",
        "'Page 3 of 5';",
        "'12/05/2026';",
        "'2/5/2026';",
        "'Reviews';",
        "'(see reviews)';",
        "'★★★★★';",
        "import value from '4.5/5';",
        "export { value } from '4.5/5';",
        "export * from '4.5/5';",
        "type C = '4.5/5';",
        'type C = `4.5/5`;',
        "'14.5/5'; '4.55/5'; '4/50'; '4/5/';",
        '<Text>★{rating}</Text>',
    ].map(code => ({ code, filename: 'example.tsx' })),
    invalid: [
        ...['★ 4.5', '4.5 ★', '★★★★☆ 4', '⭐ 4', '✩ 4', '✪ 4', '✮ 4', '✯ 4', '🌟 4',
            '(12 reviews)', '(1 review)', '(1,204 ratings)', '(2 Ratings)',
            '4.5/5', '4 / 5', '3.5 /5', '★ 4.5/5 (12 reviews)',
        ].map(text => ({
            code: `${JSON.stringify(text)};`,
            filename: 'example.tsx',
            errors: [{ messageId: 'fabricated', data: { text } }],
        })),
        ...['(12 reviews)', '★ 4.5'].map(text => ({
            code: `<Text>${text}</Text>`,
            filename: 'example.tsx',
            errors: [{ messageId: 'fabricated', data: { text }, type: 'JSXText' }],
        })),
        {
            code: '`Rated 4.5/5 by ${n}`;',
            filename: 'example.tsx',
            errors: [{ messageId: 'fabricated', data: { text: '4.5/5' }, type: 'TemplateElement' }],
        },
        {
            code: '<Text accessibilityLabel="4.5/5" />',
            filename: 'example.tsx',
            errors: [{ messageId: 'fabricated', data: { text: '4.5/5' } }],
        },
        {
            code: '`(12 reviews) ${n} 4.5/5`;',
            filename: 'example.tsx',
            errors: [
                { messageId: 'fabricated', data: { text: '(12 reviews)' } },
                { messageId: 'fabricated', data: { text: '4.5/5' } },
            ],
        },
        {
            code: "const t = '4.5/5' as const; const u = '(12 reviews)' satisfies string;",
            filename: 'example.tsx',
            errors: [
                { messageId: 'fabricated', data: { text: '4.5/5' } },
                { messageId: 'fabricated', data: { text: '(12 reviews)' } },
            ],
        },
        {
            code: 'const t = `Rated 4.5/5` as string;',
            filename: 'example.tsx',
            errors: [{ messageId: 'fabricated', data: { text: '4.5/5' }, type: 'TemplateElement' }],
        },
    ],
});
