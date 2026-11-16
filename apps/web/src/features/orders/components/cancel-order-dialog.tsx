import { type FormEvent, type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BUYER_CANCEL_REASONS,
  FARMER_CANCEL_REASONS,
  UserRole,
} from "@bazarbeat/shared";

import { Button } from "../../../components/ui/button.js";
import { Select } from "../../../components/ui/select.js";

export interface CancelOrderDialogProps {
  isOpen: boolean;
  orderId?: string;
  role?: UserRole;
  isPending: boolean;
  error?: string | null;
  onCancel: (payload: { reason: string; note?: string }) => Promise<void> | void;
  onClose: () => void;
}

export function CancelOrderDialog({
  isOpen,
  role = UserRole.FARMER,
  isPending,
  error,
  onCancel,
  onClose,
}: CancelOrderDialogProps): ReactElement | null {
  const { t } = useTranslation();

  const isBuyer = role === UserRole.BUYER;
  const reasonsList = isBuyer ? BUYER_CANCEL_REASONS : FARMER_CANCEL_REASONS;

  const [reason, setReason] = useState<string>(reasonsList[0]);
  const [note, setNote] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setValidationError(null);

    if (!reason) {
      setValidationError(t("orders.cancel.reasonRequired", "Please choose a reason for cancellation."));
      return;
    }

    if (note.length > 200) {
      setValidationError(t("orders.cancel.noteTooLong", "Note must not exceed 200 characters."));
      return;
    }

    await onCancel({
      reason,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    >
      <div
        className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cancel-dialog-title" className="text-lg font-bold text-rose-950">
          {t("orders.cancel.title", "Cancel Order")}
        </h3>

        <p className="mt-1 text-sm text-stone-600">
          {t(
            "orders.cancel.description",
            "Cancelling an order releases the commitment. Please provide a clear reason.",
          )}
        </p>

        {/* Visible note for buyers that cancelling after winning is recorded */}
        {isBuyer && (
          <div
            data-testid="buyer-cancel-reliability-warning"
            className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          >
            <span className="font-bold text-amber-800" aria-hidden="true">⚠️</span>
            <p>
              {t(
                "orders.cancel.buyerReliabilityWarning",
                "Note: Cancelling an order after winning the auction is recorded on your profile and affects your buyer reliability score.",
              )}
            </p>
          </div>
        )}

        {(validationError || error) && (
          <div
            role="alert"
            className="mt-3 rounded border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
          >
            {validationError || error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-semibold text-stone-700">
              {t("orders.cancel.reasonLabel", "Reason for Cancellation *")}
            </label>
            <Select
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              required
            >
              {reasonsList.map((r: string) => (
                <option key={r} value={r}>
                  {t(`orders.cancelReason.${r}`, r)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="cancel-note" className="block text-xs font-semibold text-stone-700">
              {t("orders.cancel.noteLabel", "Explanation / Note (Optional, max 200 chars)")}
            </label>
            <textarea
              id="cancel-note"
              rows={3}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(
                "orders.cancel.notePlaceholder",
                "Provide details about why the order cannot be fulfilled.",
              )}
              className="mt-1 block w-full rounded-md border border-stone-300 p-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {note.length} / 200
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="bg-stone-100 text-stone-800 hover:bg-stone-200"
              onClick={onClose}
              disabled={isPending}
            >
              {t("orders.cancel.closeButton", "Keep Order")}
            </Button>
            <Button
              type="submit"
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={isPending}
            >
              {isPending
                ? t("orders.cancel.submitting", "Cancelling…")
                : t("orders.cancel.submitButton", "Confirm Cancellation")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
