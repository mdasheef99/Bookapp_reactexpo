const STAR = /[★☆⭐✩✪✮✯\u{1F31F}]/u;
const COUNT = /\(\s*\d[\d,.]*\s+(?:reviews?|ratings?)\s*\)/i;
const SCORE = /(?<![\d./])\d(?:\.\d)?\s?\/\s?5(?![\d/])/;

// Type-position literals (`type C = '4/5'`) are skipped; value wrappers like `'4/5' as string` are still checked.
const VALUE_WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion']);
const inTypePosition = parent => parent.type.startsWith('TS') && !VALUE_WRAPPERS.has(parent.type);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'problem',
        schema: [],
        messages: {
            fabricated: 'Literal rating or review text ({{text}}) is not allowed; render ratings only from data fields (DP-04).',
        },
    },
    create(context) {
        function checkText(node, value) {
            const parent = node.parent;
            if (typeof value !== 'string' || inTypePosition(parent)) return;
            // A type's template quasi has a TemplateLiteral between it and the TS type node.
            if (node.type === 'TemplateElement' && parent.parent && inTypePosition(parent.parent)) return;
            if (parent.source === node && ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(parent.type)) return;
            const text = STAR.test(value) && /\d/.test(value) ? value.trim()
                : (value.match(COUNT) || value.match(SCORE))?.[0];
            if (text) context.report({ node, messageId: 'fabricated', data: { text } });
        }

        return {
            Literal(node) { checkText(node, node.value); },
            TemplateElement(node) { checkText(node, node.value.cooked); },
            JSXText(node) { checkText(node, node.value); },
        };
    },
};
