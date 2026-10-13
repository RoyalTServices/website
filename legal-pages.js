import {config} from './site-config.js';
import {policies, policyDate} from './legal-content.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const legalRoutes = ['/website-policies', ...policies.map(policy => policy.path)];
export function legalTitle(path) { return policies.find(p => p.path === path)?.title || 'Website Policies'; }
export function renderBusinessDisclosure() {
  return '<div class="footer-business"><a href="/website-policies" data-link>Website policies →</a></div>';
}
function draftNotice() {
  return config.legal?.status === 'draft' ? '<p class="policy-draft"><strong>Draft for review.</strong> Business details and operating terms are being confirmed before these policies are finalised.</p>' : '';
}
function businessDetails() {
  return '<p class="policy-help">For shipping, billing or privacy enquiries, visit our <a href="/contact" data-link>Contact page</a>.</p>';
}
function policyNav(path) {
  return `<nav class="policy-nav" aria-label="Website policies"><a href="/website-policies" data-link ${path === '/website-policies' ? 'aria-current="page"' : ''}>Policy index</a>${policies.map(p => `<a href="${p.path}" data-link ${p.path === path ? 'aria-current="page"' : ''}>${escape(p.title)}</a>`).join('')}<a href="/contact" data-link>Contact us →</a></nav>`;
}
export function renderLegalPage(path) {
  const policy = policies.find(p => p.path === path);
  const title = legalTitle(path);
  const body = policy
    ? `<article class="policy-copy">${policy.sections.map(([heading,text],i) => `<section><h2>${i+1}. ${escape(heading)}</h2><p>${escape(text)}</p></section>`).join('')}<div class="policy-help"><p>For our website policies, see <a href="/website-policies" data-link>Website Policies</a>.</p>${policy.path === '/cookie-policy' ? '<p>External notices: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a> and <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">WhatsApp Privacy Policy</a>.</p>' : ''}${policy.path === '/grievance-redressal' ? '<p><a href="https://consumerhelpline.gov.in/" target="_blank" rel="noopener noreferrer">Visit the National Consumer Helpline →</a></p>' : ''}</div></article>`
    : `<div>${businessDetails()}<section class="policy-index"><h2>Our website policies</h2>${policies.map(p => `<a href="${p.path}" data-link><h3>${escape(p.title)} <span aria-hidden="true">→</span></h3><p>${escape(p.summary)}</p></a>`).join('')}</section></div>`;
  return `<div class="page-intro"><p class="eyebrow"><span></span>ROYAL T · POLICIES</p><h1>${escape(title)}</h1><p>${escape(policy?.summary || 'Read the policies for our website and courier services.')}</p><p class="policy-date">Last updated: ${policyDate} · ${escape(config.legal?.legalName || config.name)}</p></div>${draftNotice()}<div class="policy-layout">${policyNav(path)}${body}</div>`;
}
