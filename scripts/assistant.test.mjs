import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledge, matchQuestions, AssistantSession} from '../assistant-knowledge.js';

test('library includes at least 200 example questions with unique topics and valid actions', () => {
  assert.ok(knowledge.reduce((sum, entry) => sum + entry.examples.length, 0) >= 200);
  assert.equal(new Set(knowledge.map(e => e.id)).size, knowledge.length);
  for (const entry of knowledge) { assert.ok(entry.answer); assert.ok(!entry.href || entry.href.startsWith('/')); }
});
test('all example phrasings retrieve their own answer first', () => {
  for (const entry of knowledge) for (const example of entry.examples) assert.equal(matchQuestions(example)[0]?.id, entry.id, example);
});
test('customer delay example retrieves late delivery', () => {
  assert.equal(matchQuestions("It's been 3 days since my delivery due date. Still it is not delivered.")[0]?.id, 'late-delivery');
});
test('informal pickup and pending collection descriptions retrieve the missed-pickup question', () => {
  for (const query of [
    'My pick is not done yet.',
    'My pick up has not been done yet',
    "My pick-up hasn't happened",
    'My pickup is still pending',
    'My collection has not been done',
    'The parcel has not been collected',
  ]) assert.equal(matchQuestions(query)[0]?.id, 'pickup-missed', query);
});
test('pickup aliases preserve booking/change intents without confusing delivery complaints', () => {
  assert.equal(matchQuestions('I want to book a pick up')[0]?.id, 'pickup');
  assert.equal(matchQuestions('Please cancel my pick up')[0]?.id, 'pickup-change');
  assert.notEqual(matchQuestions('My delivery is not done yet')[0]?.id, 'pickup-missed');
  assert.deepEqual(matchQuestions('I need to pick a colour'), []);
});
test('complaints and pricing wording are distinguished', () => {
  for (const [query, intent] of [
    ['My parcel is damaged and the box broken', 'damage'],
    ['It is marked delivered but not received', 'false-delivery'],
    ['How much are international shipping rates?', 'international-price'],
    ['What is the domestic delivery price within India?', 'domestic-price'],
    ['My shipment is held at customs', 'customs-delay'],
    ['There has been no tracking update', 'no-updates'],
  ]) assert.equal(matchQuestions(query)[0]?.id, intent, query);
});
test('unrelated and empty messages do not fabricate a match', () => {
  for (const text of ['', 'hello', 'tell me about astronomy', '<script>alert(1)</script>']) assert.deepEqual(matchQuestions(text), []);
});
test('mailbox stays locked until three unsuccessful responses and repeat feedback cannot count twice', () => {
  const session = new AssistantSession();
  session.reject(); assert.equal(session.failures, 0);
  for (let i = 1; i <= 3; i++) {
    session.ask('unrelated astronomy'); session.reject(); session.reject();
    assert.equal(session.failures, i);
    assert.equal(session.stage, i === 3 ? 'issue' : 'questions');
  }
  assert.deepEqual(session.ask('shipping cost'), []);
  assert.equal(session.transcript.length, 3);
});
test('successful feedback resets unsuccessful attempts', () => {
  const session = new AssistantSession(); session.ask('shipping cost'); session.reject(); session.ask('parcel damaged'); session.resolve();
  assert.equal(session.failures, 0); assert.equal(session.stage, 'questions'); assert.equal(session.pending, false);
});
