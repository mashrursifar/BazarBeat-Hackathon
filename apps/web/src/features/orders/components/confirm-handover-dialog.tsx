import { type FormEvent, type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";

export interface ConfirmHandoverDialogProps {
  isOpen: boolean;
  orderId?: string;
  prefilledNote?: string;
  isPending: boolean;
  error?: string | null;
  onConfirm: (payload: { handoverAt: string; note?: string }) => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmHandoverDialog({
  isOpen,
  prefilledNote = "",
  isPending,
  error,
  onConfirm,
  onClose,
}: ConfirmHandoverDialogProps): ReactElement | null {
  const { t } = useTranslation();

  // Default handover time: 24 hours from now in local input format "YYYY-MM-DDTHH:mm"
  const getInitialDateTime = (): string => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // Format to local ISO datetime without seconds/ms for datetime-local input
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [handoverAt, setHandoverAt] = useState<string>(getInitialDateTime());
  const [note, setNote] = useState<string>(prefilledNote);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setValidationError(null);

    if (!handoverAt) {
      setValidationError(t("orders.confirm.timeRequired", "Please choose a handover date and time."));
      return;
    }

    const selectedTime = new Date(handoverAt).getTime();
    const now = Date.now();
    const maxTime = now + 72 * 60 * 60 * 1000;

    if (isNaN(selectedTime)) {
      setValidationError(t("orders.confirm.timeInvalid", "Invalid date format."));
      return;
    }

    if (selectedTime < now - 60 * 1000) {
      setValidationError(t("orders.confirm.timePast", "Handover time must be in the future."));
      return;
    }

    if (selectedTime > maxTime + 60 * 1000) {
      setValidationError(t("orders.confirm.timeMax72h", "Handover time must be within 72 hours from now."));
      return;
    }

    if (note.length > 200) {
      setValidationError(t("orders.confirm.noteTooLong", "Note must not exceed 200 characters."));
      return;
    }

    const isoDate = new Date(handoverAt).toISOString();
    await onConfirm({
      handoverAt: isoDate,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    >
      <div
        className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-bold text-stone-900">
          {t("orders.confirm.title", "Confirm Order & Set Handover")}
        </h3>

        <p className="mt-1 text-sm text-stone-600">
          {t(
            "orders.confirm.description",
            "Set the estimated handover time when produce will be ready for buyer pickup. Must be within 72 hours.",
          )}
        </p>

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
            <label htmlFor="handover-time" className="block text-xs font-semibold text-stone-700">
              {t("orders.confirm.handoverTimeLabel", "Handover Date & Time * (Within 72 hours)")}
            </label>
            <Input
              id="handover-time"
              type="datetime-local"
              value={handoverAt}
              onChange={(e) => setHandoverAt(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <label htmlFor="handover-note" className="block text-xs font-semibold text-stone-700">
              {t("orders.confirm.pickupNoteLabel", "Pickup Note / Instructions (Optional, max 200 chars)")}
            </label>
            <textarea
              id="handover-note"
              rows={3}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(
                "orders.confirm.notePlaceholder",
                "e.g. Call 1 hour before arriving at farm gate.",
              )}
              className="mt-1 block w-full rounded-md border border-stone-300 p-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              {t("orders.confirm.cancelButton", "Close")}
            </Button>
            <Button
              type="submit"
              className="bg-primary text-white"
              disabled={isPending}
            >
              {isPending
                ? t("orders.confirm.submitting", "Confirming…")
                : t("orders.confirm.submitButton", "Confirm Order")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
