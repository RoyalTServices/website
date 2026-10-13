import test from 'node:test';
import assert from 'node:assert/strict';
import {isOutsideChat} from '../assistant.js';

test('selecting a response stays inside even after its DOM node is removed', () => {
  const panel = {contains:() => false}, launch = {}, work = {}, removedResponse = {parentNode:null};
  const click = {target:removedResponse, composedPath:() => [removedResponse,work,panel,{},{}]};
  assert.equal(panel.contains(click.target),false, 'The old containment check misclassifies a replaced response.');
  assert.equal(isOutsideChat(click,panel,launch),false);
});
test('question, feedback, category and new-chat interactions are not outside clicks', () => {
  const panel = {}, launch = {};
  for (const control of ['question','helpful','try-again','category','new-chat','submit']) {
    const target = {control};
    assert.equal(isOutsideChat({composedPath:() => [target,{},panel,{}]},panel,launch),false,control);
  }
});
test('launcher clicks keep the chat open and clicks elsewhere dismiss it', () => {
  const panel = {}, launch = {}, page = {};
  assert.equal(isOutsideChat({composedPath:() => [{},launch,page]},panel,launch),false);
  assert.equal(isOutsideChat({composedPath:() => [{},page]},panel,launch),true);
});
