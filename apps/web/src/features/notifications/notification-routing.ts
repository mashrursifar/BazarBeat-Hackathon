import { type NotificationItem, NotificationType, UserRole } from "@bazarbeat/shared";

/**
 * Pure route navigation mapper (Task 8.6 / docs/phase-8.md).
 *
 * Routing Rules:
 * - OUTBID and buyer ENDING_SOON -> /buyer/marketplace/${listingId}
 * - NEW_BID and farmer ENDING_SOON -> /farmer/crop-bidding
 * - AUCTION_UNSOLD -> /farmer/products?tab=ENDED
 * - AUCTION_SOLD -> /farmer/orders/${orderId}
 * - AUCTION_WON -> /buyer/orders/${orderId}
 * - AUCTION_LOST -> /buyer/marketplace/${listingId}
 * - ORDER_UPDATE -> /${role}/orders/${orderId}
 */
export function getNotificationTargetRoute(
  notification: NotificationItem,
  role: UserRole,
): string {
  const isFarmer = role === UserRole.FARMER;
  const entityId = notification.entityRef.id;

  switch (notification.type) {
    case NotificationType.NEW_BID:
      return "/farmer/crop-bidding";

    case NotificationType.OUTBID:
      return `/buyer/marketplace/${entityId}`;

    case NotificationType.ENDING_SOON:
      return isFarmer ? "/farmer/crop-bidding" : `/buyer/marketplace/${entityId}`;

    case NotificationType.AUCTION_UNSOLD:
      return "/farmer/products?tab=ENDED";

    case NotificationType.AUCTION_SOLD: {
      const orderId =
        "orderId" in notification.params && typeof notification.params.orderId === "string"
          ? notification.params.orderId
          : entityId;
      return `/farmer/orders/${orderId}`;
    }

    case NotificationType.AUCTION_WON: {
      const orderId =
        "orderId" in notification.params && typeof notification.params.orderId === "string"
          ? notification.params.orderId
          : entityId;
      return `/buyer/orders/${orderId}`;
    }

    case NotificationType.AUCTION_LOST:
      return `/buyer/marketplace/${entityId}`;

    case NotificationType.ORDER_UPDATE: {
      const orderId =
        "orderId" in notification.params && typeof notification.params.orderId === "string"
          ? notification.params.orderId
          : entityId;
      const baseRole = isFarmer ? "farmer" : "buyer";
      return `/${baseRole}/orders/${orderId}`;
    }

    default:
      return isFarmer ? "/farmer/dashboard" : "/buyer/dashboard";
  }
}
