module.exports = {
    meta: { name: 'eslint-plugin-book-section', version: '1.0.0' },
    rules: {
        'no-raw-style-values': require('./no-raw-style-values'),
        'require-accessible-name': require('./require-accessible-name'),
        'no-fabricated-ratings': require('./no-fabricated-ratings'),
    },
};
