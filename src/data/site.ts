export const siteConfig = {
  name: 'Elite Automations',
  description: 'AI-powered automation for professional services',
  phone: '07347 507295',
  email: 'hello@eliteautomations.co.uk',
  pricing: {
    setup: 499,
    monthly: 49,
  },
  sectors: [
    {
      id: 'dentists',
      name: 'Dentists',
      description: 'Automated patient follow-ups and appointment scheduling',
      benefits: [
        'Reduce no-shows by 40%',
        'Automate appointment reminders',
        'Patient feedback collection',
      ],
    },
    {
      id: 'estate-agents',
      name: 'Estate Agents',
      description: 'Streamline property viewings and client communications',
      benefits: [
        'Instant viewing confirmations',
        'Automated property alerts',
        'Lead qualification system',
      ],
    },
    {
      id: 'solicitors',
      name: 'Solicitors',
      description: 'Client case updates and document management automation',
      benefits: [
        'Automated case status updates',
        'Document collection workflows',
        'Secure client portal access',
      ],
    },
    {
      id: 'accountants',
      name: 'Accountants',
      description: 'Tax deadline reminders and document submission automation',
      benefits: [
        'Deadline reminder system',
        'Automated document requests',
        'Client onboarding automation',
      ],
    },
  ],
} as const;
