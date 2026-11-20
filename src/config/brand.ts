/**
 * Centralized, configurable brand identity for the platform.
 * Changing `appName` here updates UI headers, page titles, emails/templates,
 * and authentication copy across the application.
 */
export const BRAND_CONFIG = {
  appName: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_APP_BRAND_NAME) || 'PermitPulse',
  subtitle: 'Business Compliance Workspace',
  industryFocus: 'HVAC & Field Service Operations',
  defaultWarningThresholdDays: 60,
  defaultReminderIntervals: [60, 30, 7, 0] as const,
  organizationalDisclaimer:
    'Organizational and preventive record-keeping tool. Does not constitute legal advice or automatically certify legal or regulatory compliance.',
} as const;
