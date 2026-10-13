import test from 'node:test';
import assert from 'node:assert/strict';
import {matchQuestions, AssistantSession} from '../assistant-knowledge.js';
import {evaluationCases, unrelatedCases} from './fixtures/assistant-evaluation.mjs';
import {model} from '../assistant-model.js';
import {challengeCases} from './fixtures/assistant-challenge.mjs';

test('trained model covers the complete topic library with 500+ labelled examples', () => {
  assert.equal(model.algorithm, 'multinomial logistic regression');
  assert.ok(model.samples >= 500);
  assert.equal(model.labels.length,36);
});
test('development validation identifies at least 95% of 105 varied sentences first', () => {
  const cases = Object.entries(evaluationCases).flatMap(([id,texts]) => texts.map(text => ({id,text})));
  const correct = cases.filter(({id,text}) => matchQuestions(text)[0]?.id === id).length;
  assert.ok(correct/cases.length >= .95, `${correct}/${cases.length} correct`);
});
test('unrelated uses of delivery, price, collection and damage do not force courier answers', () => {
  for (const text of unrelatedCases) assert.deepEqual(matchQuestions(text),[],text);
});
test('separate challenge sentences across all 35 topics retrieve the correct question', () => {
  for (const [id,text] of challengeCases) assert.equal(matchQuestions(text)[0]?.id,id,text);
});
test('minor spelling mistakes retain the intended complaint', () => {
  for (const [text,id] of [
    ['My pikup has not happened','pickup-missed'],
    ['My collction is overdue','pickup-missed'],
    ['The parcle arrived damged','damage'],
    ['My trakcing has no new updates','no-updates'],
    ['The delivrey is late','late-delivery'],
  ]) assert.equal(matchQuestions(text)[0]?.id,id,text);
});
test('short follow-ups use the previous customer topic', () => {
  for (const [id,text,expected] of [
    ['pickup','It is still not done','pickup-missed'],
    ['pickup-missed','Nobody came again','pickup-missed'],
    ['pickup','Can you cancel it','pickup-change'],
    ['pickup','Please move it to tomorrow','pickup-change'],
    ['late-delivery','It is still pending','late-delivery'],
    ['no-updates','Same status for four days','no-updates'],
  ]) {
    const session = new AssistantSession(); session.select(id);
    assert.equal(session.ask(text)[0]?.id,expected,text);
  }
});
test('explicit new topics override previous conversation and success clears context', () => {
  const session = new AssistantSession(); session.select('pickup-missed');
  assert.equal(session.ask('What is the shipping cost to Canada')[0]?.id,'international-price');
  session.resolve(); assert.equal(session.context,null);
  assert.deepEqual(session.ask('It is not done yet'),[]); assert.equal(session.needsClarification,true);
});
test('clarifying a vague statement uses the chosen category without claiming a match first', () => {
  const session = new AssistantSession();
  assert.deepEqual(session.ask('Still waiting'),[]); assert.equal(session.needsClarification,true);
  session.setCategory('Pickup'); assert.equal(session.ask('Still waiting')[0]?.id,'pickup-missed');
  assert.equal(session.failures,0);
});
test('contextual follow-ups do not count as failed answers and rejected clarifications count once', () => {
  const session = new AssistantSession(); session.select('pickup');
  session.ask('Still not done'); session.ask('Can you cancel it');
  assert.equal(session.failures,0);
  session.resolve(); session.ask('Not done yet'); session.reject(); session.reject();
  assert.equal(session.failures,1); assert.equal(session.needsClarification,false);
});
