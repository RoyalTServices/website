import {config} from './site-config.js';
import {knowledge, AssistantSession} from './assistant-knowledge.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function isOutsideChat(event, panel, launch) {
  // The original event path survives even when a response replaces the clicked element.
  const path = event.composedPath();
  return !path.includes(panel) && !path.includes(launch);
}

export function mountAssistant() {
  const host = document.createElement('div');
  host.className = 'assistant';
  const indiaNumber = value => {
    const digits = String(value || '').replace(/\D/g, '');
    return /^[6-9]\d{9}$/.test(digits) ? '91' + digits : /^91[6-9]\d{9}$/.test(digits) ? digits : '';
  };
  const phone = indiaNumber(config.phone), whatsapp = indiaNumber(config.whatsapp);
  const contactButton = (kind, label, href, icon) => href
    ? `<a class="assistant-contact ${kind}" aria-label="${label}" title="${label}" href="${href}" ${kind === 'whatsapp' ? 'target="_blank" rel="noopener noreferrer"' : ''}>${icon}</a>`
    : `<button type="button" class="assistant-contact ${kind}" aria-label="${label} — number not configured" title="${label} — number not configured" aria-disabled="true" data-contact-unavailable>${icon}</button>`;
  const callIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21a1.5 1.5 0 0 0 1.5-1.5V17l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z"/></svg><span class="assistant-india-code" aria-hidden="true">+91</span>';
  const whatsappIcon = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M27 15.5A11.5 11.5 0 0 1 10 25.6L4 27l1.5-5.8A11.5 11.5 0 1 1 27 15.5Z" class="whatsapp-bubble"/><path d="M11 9.5h2l1.5 4-1.8 1.6a12 12 0 0 0 4.2 4.2l1.6-1.8 4 1.5v2c0 1.2-1.2 1.8-2.3 1.6-6.3-1-11.6-6.3-12.6-12.6-.2-1.1.4-2.3 1.6-2.3Z" class="whatsapp-phone"/></svg>';
  host.innerHTML = `<div class="assistant-tools" aria-label="Customer support tools">${contactButton('india-call', 'Call Royal T in India (+91)', phone ? 'tel:+' + phone : '', callIcon)}${contactButton('whatsapp', 'Chat with Royal T on WhatsApp', whatsapp ? 'https://wa.me/' + whatsapp : '', whatsappIcon)}<button class="assistant-launch" aria-label="Open Royal T assistant" title="Royal T assistant" aria-expanded="false" aria-controls="assistant-panel"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M22 7H9a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h3l5 3v-3h6a5 5 0 0 0 5-5v-6"/><path class="assistant-spark" d="m26 2 1.5 4.5L32 8l-4.5 1.5L26 14l-1.5-4.5L20 8l4.5-1.5Z"/><path d="M10 17h.1m5.9 0h.1m5.9 0h.1" class="assistant-chat-dots"/></svg></button></div><p class="assistant-contact-status" role="status" hidden></p>
    <section id="assistant-panel" class="assistant-panel" aria-label="Royal T customer assistant" hidden>
      <header class="assistant-header"><img class="assistant-logo" src="/assets/royal-t-logo.jpeg" alt="Royal T Courier Services"><button type="button" class="assistant-restart" aria-label="Start a new conversation">New chat</button></header>
      <div class="assistant-body"><p class="assistant-intro">Choose a question or describe what you need.</p><p class="assistant-privacy">Avoid sharing card details, passwords or identity documents.</p>
      <div class="assistant-log" role="log" aria-live="polite" aria-relevant="additions"></div><div class="assistant-work"></div></div>
    </section>`;
  document.body.append(host);
  host.querySelectorAll('[data-contact-unavailable]').forEach(button => button.addEventListener('click', () => {
    const status = host.querySelector('.assistant-contact-status');
    status.textContent = 'Our contact number will be available soon.'; status.hidden = false;
  }));
  const find = selector => host.querySelector(selector);
  const panel = find('.assistant-panel'), launch = find('.assistant-launch'), work = find('.assistant-work'), log = find('.assistant-log');
  const cacheKey = 'royal-t-chat-v1';
  let session = new AssistantSession(), lastQuestion = '', view = {}, restoring = true;
  function saveConversation() {
    const fields = {};
    work.querySelectorAll('input, textarea, select').forEach(field => {
      if (field.id) fields[field.id] = field.type === 'checkbox' ? field.checked : field.value;
    });
    try { sessionStorage.setItem(cacheKey, JSON.stringify({session, lastQuestion, view, fields})); } catch { /* Chat still works when browser storage is unavailable. */ }
  }
  function message(role, text) {
    session.record(role, text);
    const item = document.createElement('p');
    item.className = `assistant-message ${role === 'customer' ? 'customer' : ''}`;
    item.textContent = text;
    log.append(item);
    item.scrollIntoView({block:'nearest'});
  }
  function chips(entries) { return entries.map(entry => `<button type="button" class="assistant-question" data-question="${entry.id}">${escape(entry.question)}</button>`).join(''); }
  function questionForm() {
    return `<form class="assistant-query"><label for="assistant-query">Your question</label><div class="assistant-input"><input id="assistant-query" name="question" required maxlength="1000" placeholder="e.g. My delivery is 3 days late"><button type="submit">Ask</button></div></form>`;
  }
  function showQuestions(entries = knowledge.filter(e => ['late-delivery','tracking','price','pickup'].includes(e.id)), suggested = false) {
    view = {type:'questions', ids:entries.map(entry => entry.id), suggested};
    work.innerHTML = `${suggested ? '<p class="assistant-label">Is one of these your question?</p>' : `<label class="assistant-label" for="assistant-category">Browse common questions</label><select id="assistant-category"><option value="">Popular questions</option>${[...new Set(knowledge.map(e => e.category))].map(c => `<option>${c}</option>`).join('')}</select>`}<div class="assistant-questions">${chips(entries)}</div>${suggested || session.needsClarification ? '<button type="button" class="assistant-reject">None of these matches</button>' : ''}${questionForm()}`;
    find('#assistant-category')?.addEventListener('change', event => {
      session.setCategory(event.target.value);
      find('.assistant-questions').innerHTML = chips(event.target.value ? knowledge.filter(e => e.category === event.target.value) : entries);
    });
    bindQuery();
  }
  function showAnswer(entry) {
    view = {type:'answer', id:entry.id};
    work.innerHTML = `${entry.href ? `<a class="assistant-action" href="${escape(entry.href)}" data-link>Open ${entry.category === 'Pricing' ? 'shipping quote' : 'related page'} →</a>` : ''}<p class="assistant-label">Did this answer your question?</p><div class="assistant-feedback"><button type="button" data-helpful>Yes, thank you</button><button type="button" class="assistant-reject">No, try again</button></div>${questionForm()}`;
    bindQuery();
  }
  function bindQuery() {
    find('.assistant-query').addEventListener('submit', event => {
      event.preventDefault();
      const text = new FormData(event.target).get('question').trim();
      if (!text) return;
      // Follow-ups and topic changes are not failures. Count explicit rejection or no match.
      lastQuestion = text;
      if (session.stage === 'issue') { message('customer', text); showIssue(); return; }
      const matches = session.ask(text);
      const item = document.createElement('p'); item.className = 'assistant-message customer'; item.textContent = text; log.append(item);
      if (!matches.length) {
        message('assistant', session.needsClarification ? 'Is this about a pickup, a delivery, tracking or pricing? Choose a topic below, then tell me what has happened. I’ll use that context for your next message.' : 'I’m not confident which courier question you mean. Choose a topic below or describe what happened, such as a missed collection or an overdue delivery.');
        if (!session.needsClarification) session.reject();
        if (session.stage === 'issue') showIssue(); else showQuestions();
      } else {
        message('assistant', 'Choose a question below to see its answer.');
        showQuestions(matches, true);
      }
    });
  }
  function reject() {
    session.reject();
    message('assistant', session.stage === 'issue' ? 'Three attempts have not resolved your question. You can now describe the issue for our team.' : 'Let’s try again. Choose another topic or rephrase your question.');
    if (session.stage === 'issue') showIssue(); else showQuestions();
  }
  work.addEventListener('click', event => {
    const chosen = event.target.closest('[data-question]');
    if (chosen && session.stage === 'questions') {
      const entry = knowledge.find(e => e.id === chosen.dataset.question);
      if (!entry) return;
      lastQuestion = entry.question;
      session.select(entry.id);
      message('customer', entry.question); message('assistant', entry.answer);
      showAnswer(entry);
    } else if (event.target.closest('.assistant-reject')) reject();
    else if (event.target.closest('[data-helpful]')) {
      session.resolve(); message('assistant', 'Glad that helped. You can ask another question whenever you need.'); showQuestions();
    }
  });
  function showIssue() {
    view = {type:'issue'};
    const connected = Boolean(config.assistantIssueEndpoint);
    work.innerHTML = `<form class="assistant-issue"><p class="assistant-label">Tell the support team what happened</p><label for="assistant-name">Name</label><input id="assistant-name" name="name" required maxlength="100" autocomplete="name"><label for="assistant-email">Email for a reply</label><input id="assistant-email" name="email" type="email" required maxlength="150" autocomplete="email"><label for="assistant-tracking">Tracking ID (optional)</label><input id="assistant-tracking" name="trackingId" maxlength="80"><label for="assistant-details">Issue description</label><textarea id="assistant-details" name="message" required maxlength="3000" rows="4"></textarea><label class="assistant-consent"><input type="checkbox" name="consent" required> I agree to share these details and this conversation with support as described in the <a href="/privacy-policy" data-link>Privacy Policy</a>.</label><p class="assistant-privacy">${connected ? 'Your issue and conversation will be submitted to the Royal T support team.' : 'The support service is not connected yet. Download your issue to share with support; nothing will be sent.'}</p><button type="submit" class="assistant-submit">${connected ? 'Send issue to support' : 'Prepare issue for download'}</button><div class="assistant-result" role="status"></div></form>`;
    find('#assistant-details').value = lastQuestion;
    if (!restoring) find('#assistant-name').focus();
    const issueRequestKey=crypto.randomUUID();
    find('.assistant-issue').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.target, submit = form.querySelector('[type="submit"]'), result = find('.assistant-result');
      if (submit.disabled) return;
      const values = Object.fromEntries(new FormData(form));
      if (!values.message.trim() || !values.name.trim()) { result.textContent = 'Enter your name and a description of the issue.'; return; }
      const payload = {type:'assistant_issue',requestKey:issueRequestKey, ...values, consent:true, unsuccessfulAttempts:session.failures, transcript:session.transcript.map(item => ({...item}))};
      submit.disabled = true; result.textContent = connected ? 'Sending your issue…' : '';
      try {
        if (connected) {
          const response = await fetch(config.assistantIssueEndpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:AbortSignal.timeout(15000)});
          if (!response.ok) throw Error('Your issue could not be sent. Your details are still here. Please try again.');
          result.textContent = 'Issue received by the support service. The team will review it and reply using your email.';
          session.stage = 'submitted';
          form.querySelectorAll('input, textarea').forEach(field => field.disabled = true);
        } else {
          result.innerHTML = '<p>Issue prepared locally. It has not been sent.</p><button type="button" class="assistant-download">Download issue</button>';
          find('.assistant-download').addEventListener('click', () => {
            const text = ['ROYAL T COURIER — SUPPORT ISSUE', 'Prepared locally; not submitted.', '', `Name: ${payload.name}`, `Email: ${payload.email}`, `Tracking ID: ${payload.trackingId}`, `Issue: ${payload.message}`, '', 'Conversation:', ...payload.transcript.map(item => `${item.role}: ${item.text}`)].join('\n');
            const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
            const link = document.createElement('a'); link.href = url; link.download = 'royal-t-support-issue.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          });
        }
      } catch (error) { result.textContent = error.name === 'TimeoutError' ? 'The support service timed out. Your details are still here; please try again.' : error.message; }
      finally { submit.disabled = session.stage === 'submitted'; saveConversation(); }
    });
  }
  function toggle(open, returnFocus = true) { panel.hidden = !open; launch.setAttribute('aria-expanded', String(open)); if (open) (find('#assistant-query') || find('#assistant-name') || find('.assistant-restart')).focus(); else { saveConversation(); if (returnFocus) launch.focus(); } }
  // Close before the document's navigation handler opens the linked page.
  // Question choices and feedback keep the conversation open.
  panel.addEventListener('click', event => {
    if (event.target.closest('a[data-link]') && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) toggle(false, false);
  }, {capture:true});
  launch.addEventListener('click', () => toggle(true));
  find('.assistant-restart').addEventListener('click', () => {
    if (find('.assistant-submit')?.disabled && session.stage !== 'submitted') return;
    session = new AssistantSession(); lastQuestion = ''; log.replaceChildren(); showQuestions(); find('#assistant-query').focus();
  });
  document.addEventListener('click', event => {
    if (!panel.hidden && isOutsideChat(event, panel, launch)) toggle(false, false);
  });
  ['input', 'change', 'click', 'submit'].forEach(type => host.addEventListener(type, () => queueMicrotask(saveConversation)));
  window.addEventListener('pagehide', saveConversation);
  showQuestions();
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (cached && cached.session && Array.isArray(cached.session.transcript)) {
      const state = cached.session;
      session.failures = Math.max(0, Math.min(3, Number(state.failures) || 0));
      session.stage = ['questions','issue','submitted'].includes(state.stage) ? state.stage : 'questions';
      session.pending = Boolean(state.pending);
      session.needsClarification = Boolean(state.needsClarification);
      session.context = state.context && knowledge.some(entry => entry.category === state.context.category) ? {category:state.context.category, ...(knowledge.some(entry => entry.id === state.context.id) ? {id:state.context.id} : {})} : null;
      session.transcript = state.transcript.filter(item => ['customer','assistant'].includes(item.role) && typeof item.text === 'string').map(item => ({role:item.role, text:item.text}));
      lastQuestion = typeof cached.lastQuestion === 'string' ? cached.lastQuestion : '';
      session.transcript.forEach(item => {
        const line = document.createElement('p'); line.className = `assistant-message ${item.role === 'customer' ? 'customer' : ''}`; line.textContent = item.text; log.append(line);
      });
      const answer = knowledge.find(entry => entry.id === cached.view?.id);
      if (session.stage !== 'questions') showIssue();
      else if (cached.view?.type === 'answer' && answer) showAnswer(answer);
      else {
        const entries = Array.isArray(cached.view?.ids) ? cached.view.ids.map(id => knowledge.find(entry => entry.id === id)).filter(Boolean) : undefined;
        showQuestions(entries, Boolean(cached.view?.suggested));
      }
      work.querySelectorAll('input, textarea, select').forEach(field => {
        const value = cached.fields?.[field.id];
        if (field.type === 'checkbox') field.checked = value === true;
        else if (typeof value === 'string') field.value = value.slice(0, field.maxLength > 0 ? field.maxLength : 3000);
      });
      const category = find('#assistant-category');
      if (category?.value) find('.assistant-questions').innerHTML = chips(knowledge.filter(entry => entry.category === category.value));
      if (session.stage === 'submitted') {
        work.querySelectorAll('input, textarea, button').forEach(field => field.disabled = true);
        find('.assistant-result').textContent = 'Issue received by the support service. The team will reply using your email.';
      }
    }
  } catch { /* Ignore an invalid or unavailable cache. */ }
  restoring = false;
}
