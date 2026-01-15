export type ThemeMode = 'system' | 'light' | 'dark'
export type NewsletterFrequency = 'daily' | 'weekly' | 'monthly' | 'never'

export interface NotificationChannelPreferences {
  enabled: boolean
  orderUpdates: boolean
  promotions: boolean
  securityAlerts: boolean
}

export interface UserProfilePreferences {
  notifications: {
    sms: NotificationChannelPreferences
    email: NotificationChannelPreferences & { newsletters: boolean }
  }
  newsletters: { enabled: boolean; frequency: NewsletterFrequency }
  theme: { mode: ThemeMode }
  locale: { language: string; currency: string; timezone?: string }
  ui: { reduceMotion: boolean; highContrast: boolean }
  privacy: { showEmail: boolean; showPhone: boolean; showProfileImage: boolean }
}

// If backend always normalizes, you may not need this,
// but it's helpful as a UI fallback.
export const DEFAULT_PROFILE_PREFERENCES: UserProfilePreferences = {
  notifications: {
    sms: { enabled: false, orderUpdates: true, promotions: false, securityAlerts: true },
    email: { enabled: true, orderUpdates: true, promotions: false, securityAlerts: true, newsletters: true },
  },
  newsletters: { enabled: true, frequency: 'weekly' },
  theme: { mode: 'system' },
  locale: { language: 'en', currency: 'USD' },
  ui: { reduceMotion: false, highContrast: false },
  privacy: { showEmail: false, showPhone: false, showProfileImage: true },
}
