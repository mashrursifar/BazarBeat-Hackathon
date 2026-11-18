import {
  type NotificationItem,
  NotificationType,
  formatPoisha,
} from "@bazarbeat/shared";
import { toBanglaDigits } from "../../lib/format.js";

const CROP_NAMES: Record<string, { en: string; bn: string }> = {
  potato: { en: "Potato", bn: "আলু" },
  onion: { en: "Onion", bn: "পেঁয়াজ" },
  tomato: { en: "Tomato", bn: "টমেটো" },
  cabbage: { en: "Cabbage", bn: "বাঁধাকপি" },
  cauliflower: { en: "Cauliflower", bn: "ফুলকপি" },
};

export function getCropDisplayName(slug: string, isBangla: boolean): string {
  const crop = CROP_NAMES[slug.toLowerCase()];
  if (!crop) return slug;
  return isBangla ? crop.bn : crop.en;
}

export function formatMoneyLocalized(poisha: number, isBangla: boolean): string {
  const formatted = formatPoisha(poisha);
  return isBangla ? toBanglaDigits(formatted) : formatted;
}

export function formatCountLocalized(count: number, isBangla: boolean): string {
  return isBangla ? toBanglaDigits(count) : String(count);
}

/**
 * Pure function rendering localized title and body for any notification item (Task 8.6).
 * Renders from i18n keys using params with English fallback to notification.title and notification.body.
 */
export function renderNotificationText(
  notification: NotificationItem,
  t: (key: string, options?: Record<string, unknown>) => string,
  language = "en",
): { title: string; body: string } {
  const isBangla = language === "bn";
  const params = notification.params as Record<string, unknown>;

  const cropSlug = typeof params.cropSlug === "string" ? params.cropSlug : "produce";
  const cropName = getCropDisplayName(cropSlug, isBangla);

  const translate = (key: string, opts?: Record<string, unknown>): string =>
    t(key, { lng: language, ...opts });

  switch (notification.type) {
    case NotificationType.NEW_BID: {
      const amount =
        typeof params.currentBidPerKg === "number"
          ? formatMoneyLocalized(params.currentBidPerKg, isBangla)
          : "";
      const count =
        typeof params.bidCount === "number"
          ? formatCountLocalized(params.bidCount, isBangla)
          : "1";

      const keyTitle = "notifications.types.NEW_BID.title";
      const keyBody = "notifications.types.NEW_BID.body";
      const translatedTitle = translate(keyTitle, { crop: cropName, amount, count });
      const translatedBody = translate(keyBody, { crop: cropName, amount, count });

      return {
        title: translatedTitle !== keyTitle ? translatedTitle : notification.title,
        body: translatedBody !== keyBody ? translatedBody : notification.body,
      };
    }

    case NotificationType.OUTBID: {
      const amount =
        typeof params.newBidPerKg === "number"
          ? formatMoneyLocalized(params.newBidPerKg, isBangla)
          : "";

      const keyTitle = "notifications.types.OUTBID.title";
      const keyBody = "notifications.types.OUTBID.body";
      const translatedTitle = translate(keyTitle, { crop: cropName, amount });
      const translatedBody = translate(keyBody, { crop: cropName, amount });

      return {
        title: translatedTitle !== keyTitle ? translatedTitle : notification.title,
        body: translatedBody !== keyBody ? translatedBody : notification.body,
      };
    }

    case NotificationType.AUCTION_SOLD: {
      const amount =
        typeof params.winningBidPerKg === "number"
          ? formatMoneyLocalized(params.winningBidPerKg, isBangla)
          : "";
      const total =
        typeof params.totalAmount === "number"
          ? formatMoneyLocalized(params.totalAmount, isBangla)
          : "";

      const keyTitle = "notifications.types.AUCTION_SOLD.title";
      const keyBody = "notifications.types.AUCTION_SOLD.body";
      const translatedTitle = translate(keyTitle, { crop: cropName, amount, total });
      const translatedBody = translate(keyBody, { crop: cropName, amount, total });

      return {
        title: translatedTitle !== keyTitle ? translatedTitle : notification.title,
        body: translatedBody !== keyBody ? translatedBody : notification.body,
      };
    }

    case NotificationType.AUCTION_WON: {
      const amount =
        typeof params.winningBidPerKg === "number"
          ? formatMoneyLocalized(params.winningBidPerKg, isBangla)
          : "";
      const total =
        typeof params.totalAmount === "number"
          ? formatMoneyLocalized(params.totalAmount, isBangla)
          : "";

      const keyTitle = "notifications.types.AUCTION_WON.title";
      const keyBody = "notifications.types.AUCTION_WON.body";
      const translatedTitle = translate(keyTitle, { crop: cropName, amount, total });
      const translatedBody = translate(keyBody, { crop: cropName, amount, total });

      return {
        title: translatedTitle !== keyTitle ? translatedTitle : notification.title,
        body: translatedBody !== keyBody ? translatedBody : notification.body,
      };
    }

    case NotificationType.AUCTION_LOST: {
      const amount =
        typeof params.finalPricePerKg === "number"
          ? formatMoneyLocalized(params.finalPricePerKg, isBangla)
          : "";

      const keyTitle = "notifications.types.AUCTION_LOST.title";
      const keyBody = "notifications.types.AUCTION_LOST.body";
      const translatedTitle = translate(keyTitle, { crop: cropName, amount });
      const translatedBody = translate(keyBody, { crop: cropName, amount });

      return {
        title: translatedTitle !== keyTitle ? translatedTitle : notification.title,
        body: translatedBody !== keyBody ? translatedBody : notification.body,
      };
    }

    case NotificationType.AUCTION_UNSOLD: {
      const keyTitle = "notifications.types.AUCTION_UNSOLD.title";
      const keyBody = "notifications.types.AUCTION_UNSOLD.body";
      const translatedTitle = translate(keyTitle, { crop: cropName });
      const translatedBody = translate(keyBody, { crop: cropName });

      return {
        title: translatedTitle !== keyTitle ? translatedTitle : notification.title,
        body: translatedBody !== keyBody ? translatedBody : notification.body,
      };
    }

    case NotificationType.ENDING_SOON: {
      const keyTitle = "notifications.types.ENDING_SOON.title";
      const keyBody = "notifications.types.ENDING_SOON.body";
      const translatedTitle = translate(keyTitle, { crop: cropName });
      const translatedBody = translate(keyBody, { crop: cropName });

      return {
        title: translatedTitle !== keyTitle ? translatedTitle : notification.title,
        body: translatedBody !== keyBody ? translatedBody : notification.body,
      };
    }

    case NotificationType.ORDER_UPDATE: {
      const subEvent = typeof params.subEvent === "string" ? params.subEvent : "CREATED";
      const keyTitle = `notifications.types.ORDER_UPDATE.${subEvent}.title`;
      const keyBody = `notifications.types.ORDER_UPDATE.${subEvent}.body`;
      const translatedTitle = translate(keyTitle, { crop: cropName });
      const translatedBody = translate(keyBody, { crop: cropName });

      return {
        title: translatedTitle !== keyTitle ? translatedTitle : notification.title,
        body: translatedBody !== keyBody ? translatedBody : notification.body,
      };
    }

    default:
      return {
        title: notification.title,
        body: notification.body,
      };
  }
}
