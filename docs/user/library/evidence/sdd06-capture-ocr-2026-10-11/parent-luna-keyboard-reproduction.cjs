// Installed RN Web event-handler evidence, not browser control or full component acceptance.
const assert = require('node:assert/strict');
const PressResponder = require('react-native-web/dist/cjs/modules/usePressEvents/PressResponder');
const listeners = new Map();
global.document = {
  addEventListener(type, listener) { listeners.set(type, listener); },
  removeEventListener(type) { listeners.delete(type); },
};
function press(role, key) {
  let presses = 0;
  const target = { tagName: 'DIV', getAttribute(name) { return name === 'role' ? role : null; } };
  const event = { key, target, currentTarget: target, nativeEvent: { key, type: 'keydown' },
    persist() {}, preventDefault() {}, stopPropagation() {} };
  const responder = new PressResponder({ onPress() { presses += 1; } });
  responder.getEventHandlers().onKeyDown(event);
  listeners.get('keyup')?.({ ...event, nativeEvent: { ...event.nativeEvent, type: 'keyup' } });
  responder.reset(); listeners.clear();
  return presses;
}
const evidence = { kind: 'Installed RN Web PressResponder; no browser claim',
  focusedDivRadioSpace: press('radio', ' '), focusedDivRadioEnter: press('radio', 'Enter'), focusedDivButtonSpace: press('button', ' ') };
console.log(JSON.stringify(evidence, null, 2));
assert.equal(evidence.focusedDivRadioEnter, 1);
assert.equal(evidence.focusedDivButtonSpace, 1);
// RED: the actual component has no additional Space handler, and the installed responder omits radio Space.
assert.equal(evidence.focusedDivRadioSpace, 1, 'Focused radio Space must activate the category');
