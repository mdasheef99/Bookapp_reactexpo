const FONT_KEYS = new Set(['fontSize', 'lineHeight']);
const SPACING_KEYS = new Set([
    'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
    'paddingHorizontal', 'paddingVertical', 'paddingStart', 'paddingEnd',
    'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
    'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
    'gap', 'rowGap', 'columnGap',
]);

// Type-position literals (`type C = '#fff'`) are skipped; value wrappers like `'#fff' as const` are still checked.
const VALUE_WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion']);
const inTypePosition = parent => parent.type.startsWith('TS') && !VALUE_WRAPPERS.has(parent.type);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            rawColor: 'Raw colour {{value}}. Use a colour token from useLibraryAppearance() (LibraryAppearance.ts).',
            rawFont: 'Numeric {{key}}. Use LIBRARY_TEXT from LibraryTypography.tsx.',
            rawSpacing: 'Numeric {{key}}. Use LIBRARY_SPACING from LibraryAppearance.ts.',
        },
    },
    create(context) {
        function checkColor(node, value) {
            const parent = node.parent;
            if (typeof value !== 'string' || inTypePosition(parent)) return;
            if (parent.source === node && ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(parent.type)) return;
            if (parent.key === node && !parent.computed) return;
            const trimmed = value.trim();
            if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed) || /\b(?:rgb|rgba|hsl|hsla)\(/i.test(trimmed)) {
                context.report({ node, messageId: 'rawColor', data: { value: trimmed } });
            }
        }

        function checkValue(node, kind) {
            if (node.type === 'Literal' && typeof node.value === 'number') {
                if (kind.messageId === 'rawFont' || ![0, 1].includes(Math.abs(node.value))) {
                    context.report({ node, messageId: kind.messageId, data: { key: kind.key } });
                }
            } else if (node.type === 'UnaryExpression' && ['-', '+'].includes(node.operator)
                && node.argument.type === 'Literal' && typeof node.argument.value === 'number') {
                if (kind.messageId === 'rawFont' || ![0, 1].includes(Math.abs(node.argument.value))) {
                    context.report({ node, messageId: kind.messageId, data: { key: kind.key } });
                }
            } else if ((node.type === 'BinaryExpression' && ['+', '-'].includes(node.operator)) || node.type === 'LogicalExpression') {
                checkValue(node.left, kind);
                checkValue(node.right, kind);
            } else if (node.type === 'ConditionalExpression') {
                checkValue(node.consequent, kind);
                checkValue(node.alternate, kind);
            } else if (['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression'].includes(node.type)) {
                checkValue(node.expression, kind);
            }
        }

        return {
            Literal(node) {
                checkColor(node, node.value);
            },
            TemplateLiteral(node) {
                if (node.expressions.length === 0) checkColor(node, node.quasis[0].value.cooked);
            },
            Property(node) {
                if (node.parent.type !== 'ObjectExpression' || node.computed) return;
                const key = node.key.type === 'Identifier' ? node.key.name
                    : node.key.type === 'Literal' && typeof node.key.value === 'string' ? node.key.value : null;
                if (FONT_KEYS.has(key)) checkValue(node.value, { messageId: 'rawFont', key });
                else if (SPACING_KEYS.has(key)) checkValue(node.value, { messageId: 'rawSpacing', key });
            },
        };
    },
};
