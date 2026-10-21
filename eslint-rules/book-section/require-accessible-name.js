const COMPONENTS = new Set(['Pressable', 'TouchableOpacity', 'TextInput', 'BookButton']);
const LABELS = new Set(['accessibilityLabel', 'aria-label', 'aria-labelledby', 'accessibilityLabelledBy']);

function elementName(node) {
    if (node.type === 'JSXIdentifier') return node.name;
    if (node.type === 'JSXMemberExpression') return node.property.name;
    return null;
}

function hasValue(attribute) {
    if (!attribute.value) return false;
    const value = attribute.value.type === 'JSXExpressionContainer' ? attribute.value.expression : attribute.value;
    return !(value.type === 'Literal' && typeof value.value === 'string' && value.value.trim() === '');
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'problem',
        schema: [],
        messages: {
            missingName: '{{name}} needs an accessibilityLabel (BookButton: label) or a direct <Text> child.',
        },
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                const name = elementName(node.name);
                if (!COMPONENTS.has(name)) return;
                const named = node.attributes.some(attribute => {
                    if (attribute.type === 'JSXSpreadAttribute') return true;
                    const key = attribute.name.name;
                    if (LABELS.has(key) || (name === 'BookButton' && key === 'label')) return hasValue(attribute);
                    return key === 'accessible' && attribute.value?.type === 'JSXExpressionContainer'
                        && attribute.value.expression.type === 'Literal' && attribute.value.expression.value === false;
                });
                if (named) return;
                if (node.parent.children.some(child => child.type === 'JSXElement' && elementName(child.openingElement.name) === 'Text')) return;
                context.report({ node: node.name, messageId: 'missingName', data: { name } });
            },
        };
    },
};
