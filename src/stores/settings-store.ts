import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NotificationPreferences {
  fifteenMinuteWarning: boolean;
  onTimeReminder: boolean;
  endOfDaySummary: boolean;
}

export interface BusinessProfile {
  ownerName: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  website: string;
  location: string;
}

export interface ApiKeysState {
  firecrawlApiKey: string;
  kieApiKey: string;
}

interface SettingsStore {
  apiKeys: ApiKeysState;
  notificationPreferences: NotificationPreferences;
  businessProfile: BusinessProfile;
  setApiKey: (key: keyof ApiKeysState, value: string) => void;
  setNotificationPreference: (
    key: keyof NotificationPreferences,
    value: boolean,
  ) => void;
  setBusinessProfileField: (key: keyof BusinessProfile, value: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKeys: {
        firecrawlApiKey: "",
        kieApiKey: "",
      },
      notificationPreferences: {
        fifteenMinuteWarning: true,
        onTimeReminder: true,
        endOfDaySummary: true,
      },
      businessProfile: {
        ownerName: "Hamid",
        businessName: "Hamid Enterprise",
        businessEmail: "hello@eliteautomations.co.uk",
        businessPhone: "",
        website: "eliteautomations.co.uk",
        location: "Greater Manchester, UK",
      },
      setApiKey: (key, value) =>
        set((state) => ({
          apiKeys: {
            ...state.apiKeys,
            [key]: value,
          },
        })),
      setNotificationPreference: (key, value) =>
        set((state) => ({
          notificationPreferences: {
            ...state.notificationPreferences,
            [key]: value,
          },
        })),
      setBusinessProfileField: (key, value) =>
        set((state) => ({
          businessProfile: {
            ...state.businessProfile,
            [key]: value,
          },
        })),
    }),
    {
      name: "elite-ops-settings",
    },
  ),
);
