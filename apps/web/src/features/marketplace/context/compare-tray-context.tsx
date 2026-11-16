import {
  type ReactElement,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type BuyerListingCard } from "@bazarbeat/shared";

export const COMPARE_TRAY_STORAGE_KEY = "bazarbeat_compare_tray";
export const MAX_COMPARE_ITEMS = 4;

export type CompareRejectionReason = "limit" | "crop_mismatch";

export interface CanAddResult {
  allowed: boolean;
  reason?: CompareRejectionReason;
}

export interface CompareTrayContextValue {
  items: BuyerListingCard[];
  selectedIds: string[];
  count: number;
  isFull: boolean;
  trayCropSlug: string | null;
  trayCropNameEn: string | null;
  trayCropNameBn: string | null;
  isInTray: (id: string) => boolean;
  canAdd: (listing: BuyerListingCard) => CanAddResult;
  addItem: (listing: BuyerListingCard) => boolean;
  removeItem: (id: string) => void;
  toggleItem: (listing: BuyerListingCard) => void;
  clearTray: () => void;
}

const CompareTrayContext = createContext<CompareTrayContextValue | null>(null);

function loadInitialItems(): BuyerListingCard[] {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(COMPARE_TRAY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_COMPARE_ITEMS);
    }
  } catch {
    // Ignore JSON parse or storage access errors
  }
  return [];
}

export function CompareTrayProvider({ children }: { children: ReactNode }): ReactElement {
  const outer = useContext(CompareTrayContext);
  if (outer) {
    return <>{children}</>;
  }

  const [items, setItems] = useState<BuyerListingCard[]>(loadInitialItems);

  // Sync to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    try {
      window.sessionStorage.setItem(COMPARE_TRAY_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage write errors (e.g. quota exceeded)
    }
  }, [items]);

  const selectedIds = useMemo(() => items.map((item) => item.id), [items]);
  const firstItem = items[0] ?? null;
  const trayCropSlug = firstItem?.crop?.slug ?? null;
  const trayCropNameEn = firstItem?.crop?.nameEn ?? null;
  const trayCropNameBn = firstItem?.crop?.nameBn ?? null;
  const isFull = items.length >= MAX_COMPARE_ITEMS;

  const isInTray = useCallback(
    (id: string): boolean => {
      return items.some((item) => item.id === id);
    },
    [items],
  );

  const canAdd = useCallback(
    (listing: BuyerListingCard): CanAddResult => {
      if (items.some((item) => item.id === listing.id)) {
        return { allowed: true };
      }
      if (items.length >= MAX_COMPARE_ITEMS) {
        return { allowed: false, reason: "limit" };
      }
      if (
        items.length > 0 &&
        firstItem &&
        listing.crop.slug !== firstItem.crop.slug &&
        listing.cropId !== firstItem.cropId
      ) {
        return { allowed: false, reason: "crop_mismatch" };
      }
      return { allowed: true };
    },
    [items, firstItem],
  );

  const addItem = useCallback(
    (listing: BuyerListingCard): boolean => {
      const check = canAdd(listing);
      if (!check.allowed) return false;
      setItems((prev) => {
        if (prev.some((item) => item.id === listing.id)) return prev;
        if (prev.length >= MAX_COMPARE_ITEMS) return prev;
        return [...prev, listing];
      });
      return true;
    },
    [canAdd],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleItem = useCallback(
    (listing: BuyerListingCard) => {
      if (isInTray(listing.id)) {
        removeItem(listing.id);
      } else {
        addItem(listing);
      }
    },
    [isInTray, removeItem, addItem],
  );

  const clearTray = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CompareTrayContextValue>(
    () => ({
      items,
      selectedIds,
      count: items.length,
      isFull,
      trayCropSlug,
      trayCropNameEn,
      trayCropNameBn,
      isInTray,
      canAdd,
      addItem,
      removeItem,
      toggleItem,
      clearTray,
    }),
    [
      items,
      selectedIds,
      isFull,
      trayCropSlug,
      trayCropNameEn,
      trayCropNameBn,
      isInTray,
      canAdd,
      addItem,
      removeItem,
      toggleItem,
      clearTray,
    ],
  );

  return <CompareTrayContext.Provider value={value}>{children}</CompareTrayContext.Provider>;
}

export function useCompareTray(): CompareTrayContextValue {
  const context = useContext(CompareTrayContext);
  if (!context) {
    throw new Error("useCompareTray must be used within a CompareTrayProvider");
  }
  return context;
}
