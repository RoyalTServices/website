export const config = {
  name: 'Royal T Courier Services',
  phone: '+919000159988', whatsapp: '919000159988', email: '', address: '', hours: '',
  seo: {
    // Set the final HTTPS domain before public launch; previews remain noindex without it.
    siteUrl: 'https://royaltservices.in', indexingEnabled: true,
    // Confirmed customer markets; these do not imply a verified street/office address.
    targetCity: 'Hyderabad', targetRegion: 'Telangana',
    city: '', locality: '', region: '', postalCode: '', streetAddress: '',
    // Enable LocalBusiness markup only after the customer-facing location is confirmed.
    localBusinessVerified: false,
    googleBusinessUrl: '', sameAs: [], openingHoursSpecification: [],
    searchConsoleVerification: '', socialImage: '/assets/royal-t-logo.jpeg',
  },
  legal: {
    status: 'draft',
    legalName: 'Royal T Services Private Limited',
    registeredAddress: '', cin: '', gstin: '',
    grievanceOfficer: '', grievanceDesignation: '', grievanceEmail: '', grievancePhone: '',
    privacyEmail: '',
  },
  // Supply a same-origin endpoint or a CORS-enabled public endpoint. Never put secret API keys here.
  trackingEndpoint: '',
  requestEndpoint: '/api/requests',
  // POST assistant_issue JSON to a backend that validates and delivers to the support mailbox.
  // Keep mail provider credentials on the backend. Empty means download only, never sent.
  assistantIssueEndpoint: '',
};
