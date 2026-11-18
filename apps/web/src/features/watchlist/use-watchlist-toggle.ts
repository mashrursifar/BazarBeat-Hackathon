import { useCallback, useState } from "react";

export interface UseWatchlistToggleOptions {
  listingId: string;
  initialIsWatched?: boolean;
  onSuccess?: (isWatched: boolean) => void;
  onError?: (code: string, message: string) => void;
}

export interface UseWatchlistToggleResult {
  isWatched: boolean;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  toggle: () => Promise<boolean>;
}

export function useWatchlistToggle({
  listingId,
  initialIsWatched = false,
  onSuccess,
  onError,
}: UseWatchlistToggleOptions): UseWatchlistToggleResult {
  const [isWatched, setIsWatched] = useState<boolean>(initialIsWatched);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const toggle = useCallback(async (): Promise<boolean> => {
    const previousState = isWatched;
    const nextState = !previousState;

    // Optimistic UI update (Frontend Pattern #8)
    setIsWatched(nextState);
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const response = await fetch(
        previousState ? `/api/v1/watchlist/${listingId}` : "/api/v1/watchlist",
        {
          method: previousState ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Protection": "1",
          },
          credentials: "include",
          body: previousState ? undefined : JSON.stringify({ listingId }),
        },
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Roll back on server failure
        setIsWatched(previousState);
        const code = (json?.error?.code as string) ?? "REQUEST_FAILED";
        const message = (json?.error?.message as string) ?? "Failed to update watchlist";
        setError(message);
        setErrorCode(code);
        onError?.(code, message);
        return previousState;
      }

      onSuccess?.(nextState);
      return nextState;
    } catch {
      // Roll back on network or unexpected error
      setIsWatched(previousState);
      const code = "NETWORK_ERROR";
      const message = "Network error. Please try again.";
      setError(message);
      setErrorCode(code);
      onError?.(code, message);
      return previousState;
    } finally {
      setIsLoading(false);
    }
  }, [isWatched, listingId, onSuccess, onError]);

  return {
    isWatched,
    isLoading,
    error,
    errorCode,
    toggle,
  };
}
