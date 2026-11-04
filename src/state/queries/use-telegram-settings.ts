import { useQuery } from "@tanstack/react-query";
import { getAdminTelegramSettings } from "@/data/repositories/telegram-settings";
import type { AdminTelegramSettings } from "@/types";

export const telegramSettingsKey = ["admin_telegram_settings"] as const;

export function useAdminTelegramSettings() {
  return useQuery<AdminTelegramSettings>({
    queryKey: telegramSettingsKey,
    queryFn: () => getAdminTelegramSettings(),
  });
}
