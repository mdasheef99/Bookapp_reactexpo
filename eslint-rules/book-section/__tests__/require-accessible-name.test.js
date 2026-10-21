const { RuleTester } = require('eslint');
const rule = require('../require-accessible-name');

const tester = new RuleTester({
    languageOptions: {
        parser: require('@typescript-eslint/parser'),
        parserOptions: { ecmaFeatures: { jsx: true } },
    },
});

tester.run('require-accessible-name', rule, {
    valid: [
        '<Pressable accessibilityLabel="Close" />',
        '<Pressable accessibilityLabel={label} />',
        '<Pressable aria-label="Close" />',
        '<Pressable aria-labelledby="heading" />',
        '<Pressable accessibilityLabelledBy={headingId} />',
        '<TextInput accessibilityLabel="Title" />',
        '<Pressable><Text>Go</Text></Pressable>',
        '<TouchableOpacity><Text>Go</Text></TouchableOpacity>',
        '<Animated.Pressable><Animated.Text>Go</Animated.Text></Animated.Pressable>',
        '<BookButton label="Save" variant="primary" onPress={f} />',
        '<BookButton label={t} variant="text" />',
        '<BookButton {...props} />',
        '<Pressable {...props} />',
        '<Pressable accessible={false} />',
        '<Pressable accessibilityLabel={`Close`} />',
        '<Pressable accessibilityLabel={42} />',
        '<View />',
        '<Text>hi</Text>',
    ].map(code => ({ code, filename: 'example.tsx' })),
    invalid: [
        ['<Pressable onPress={f}><View/></Pressable>', 'Pressable'],
        ['<Pressable />', 'Pressable'],
        ['<TouchableOpacity><View><Text>x</Text></View></TouchableOpacity>', 'TouchableOpacity'],
        ['<TextInput placeholder="Name" />', 'TextInput'],
        ['<BookButton variant="primary" onPress={f} />', 'BookButton'],
        ['<Pressable accessibilityLabel="" />', 'Pressable'],
        ['<Pressable accessibilityLabel="  " />', 'Pressable'],
        ["<Pressable accessibilityLabel={''} />", 'Pressable'],
        ["<Pressable accessibilityLabel={'  '} />", 'Pressable'],
        ['<Pressable accessibilityLabel />', 'Pressable'],
        ['<Animated.Pressable />', 'Pressable'],
        ['<Animated.TouchableOpacity />', 'TouchableOpacity'],
        ['<BookButton label="" variant="primary" />', 'BookButton'],
        ['<BookButton label />', 'BookButton'],
        ['<Pressable label="Close" />', 'Pressable'],
        ['<Pressable accessible={true} />', 'Pressable'],
        ['<Pressable accessible="false" />', 'Pressable'],
        ['<Pressable><><Text>Go</Text></></Pressable>', 'Pressable'],
        ['<Pressable>{<Text>Go</Text>}</Pressable>', 'Pressable'],
        ...['aria-label', 'aria-labelledby', 'accessibilityLabelledBy'].map(attribute => [
            `<Pressable ${attribute}=" " />`, 'Pressable',
        ]),
    ].map(([code, name]) => ({
        code,
        filename: 'example.tsx',
        errors: [{
            messageId: 'missingName',
            data: { name },
            type: code.startsWith('<Animated.') ? 'JSXMemberExpression' : 'JSXIdentifier',
        }],
    })),
});
