const path = require('node:path');

function summarizeRatchet(results, repoRoot) {
    const diagnostics = results.flatMap(file => file.messages
        .map(message => ({ ...message, file: path.relative(repoRoot, file.filePath).replace(/\\/g, '/') })));
    const fatal = diagnostics.filter(message => message.fatal === true);
    if (fatal.length) {
        throw new Error(`Fatal ESLint diagnostics must be zero; found ${fatal.length}:\n${fatal
            .map(message => `${message.file}:${message.line} ${message.message}`).join('\n')}`);
    }

    const messages = diagnostics.filter(message => message.ruleId?.startsWith('book-section/'));
    const counts = {};
    for (const message of messages) {
        counts[message.ruleId] ??= { 1: 0, 2: 0 };
        counts[message.ruleId][message.severity] += 1;
    }

    const errors = messages.filter(message => message.severity === 2);
    if (errors.length) {
        throw new Error(`Book-section errors must be zero; found ${errors.length}:\n${errors
            .map(message => `${message.file}:${message.line} ${message.ruleId}`).join('\n')}`);
    }
    return { counts, messages };
}

module.exports = { summarizeRatchet };
