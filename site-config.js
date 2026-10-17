export const config = {
  name: 'Royal T Courier Services',
  phone: '+919502295222', whatsapp: '919502295222', email: '', address: '', hours: '',
  seo: {
    // Set the final HTTPS domain before public launch; previews remain noindex without it.
    siteUrl: 'https://royaltservices.in', indexingEnabled: true,
    // Confirmed customer markets; these do not imply a verified street/office address.
    targetCity: '', targetRegion: '', targetRegions: ['Andhra Pradesh','Telangana'],
    city: '', locality: '', region: '', postalCode: '', streetAddress: '',
    // Enable LocalBusiness markup only after the customer-facing location is confirmed.
    localBusinessVerified: false,
    googleBusinessUrl: '', sameAs: [], openingHoursSpecification: [],
    searchConsoleVerification: '', socialImage: '/assets/royal-t-logo.jpeg',
  },
  legal: {
    status: 'published',
    legalName: 'Royal T Services Private Limited',
    registeredAddress: '', cin: '', gstin: '',
    grievanceOfficer: '', grievanceDesignation: '', grievanceEmail: '', grievancePhone: '',
    privacyEmail: '',
  },
  // Supply a same-origin endpoint or a CORS-enabled public endpoint. Never put secret API keys here.
  trackingEndpoint: '/api/tracking',
  requestEndpoint: '/api/requests',
  // Support issues are saved to the internal enquiry queue; email delivery is separate.
  // No Supabase secret or mail credential belongs in this public configuration.
  assistantIssueEndpoint: '/api/requests',
};
