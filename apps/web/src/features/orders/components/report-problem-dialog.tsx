import { type FormEvent, type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { BUYER_DISPUTE_REASONS } from "@bazarbeat/shared";

import { Button } from "../../../components/ui/button.js";
import { Select } from "../../../components/ui/select.js";

export interface ReportProblemDialogProps {
  isOpen: boolean;
  orderId?: string;
  isPending: boolean;
  error?: string | null;
  onSubmit: (payload: { reason: string; note?: string }) => Promise<void> | void;
  onClose: () => void;
}

export function ReportProblemDialog({
  isOpen,
  isPending,
  error,
  onSubmit,
  onClose,
}: ReportProblemDialogProps): ReactElement | null {
  const { t } = useTranslation();

  const [reason, setReason] = useState<string>(BUYER_DISPUTE_REASONS[0]);
  const [note, setNote] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setValidationError(null);

    if (!reason) {
      setValidationError(
        t("orders.dispute.reasonRequired", "Please choose a reason for the problem."),
      );
      return;
    }

    if (note.length > 200) {
      setValidationError(
        t("orders.dispute.noteTooLong", "Note must not exceed 200 characters."),
      );
      return;
    }

    await onSubmit({
      reason,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-problem-title"
      data-testid="report-problem-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    >
      <div
        className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="report-problem-title" className="text-lg font-bold text-orange-950">
          {t("orders.dispute.dialogTitle", "Report a problem")}
        </h3>

        <p className="mt-1 text-sm text-stone-600">
          {t(
            "orders.dispute.dialogDescription",
            "Report an issue with the delivered produce within 24 hours. Auto-completion will be paused while the issue is reviewed.",
          )}
        </p>

        {/* AI Grade snapshot notice */}
        <div
          data-testid="dispute-snapshot-notice"
          className="mt-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900"
        >
          <span className="font-bold text-orange-800" aria-hidden="true">
            ℹ️
          </span>
          <p>
            {t(
              "orders.dispute.snapshotHelp",
              "The original AI quality grading and listing snapshots will be preserved for investigation.",
            )}
          </p>
        </div>

        {(validationError || error) && (
          <div
            role="alert"
            data-testid="dispute-error-message"
            className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-xs font-medium text-rose-800"
          >
            {validationError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="dispute-reason-select"
              className="block text-xs font-semibold text-stone-700"
            >
              {t("orders.dispute.reasonLabel", "Reason for report")} *
            </label>
            <div className="mt-1">
              <Select
                id="dispute-reason-select"
                data-testid="dispute-reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
                className="w-full"
              >
                {BUYER_DISPUTE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`orders.dispute.reasons.${r}`, r)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label
                htmlFor="dispute-note-input"
                className="block text-xs font-semibold text-stone-700"
              >
                {t("orders.dispute.noteLabel", "Additional Details (optional)")}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {note.length}/200
              </span>
            </div>
            <textarea
              id="dispute-note-input"
              data-testid="dispute-note-input"
              rows={3}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(
                "orders.dispute.notePlaceholder",
                "Describe the difference in quality, missing quantity, or produce condition…",
              )}
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-stone-300 p-2 text-xs shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              data-testid="dispute-cancel-button"
              onClick={onClose}
              disabled={isPending}
              className="h-9 border border-stone-300 bg-white px-4 text-xs font-medium text-stone-700 shadow-none hover:bg-stone-50"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              data-testid="dispute-submit-button"
              disabled={isPending}
              className="h-9 bg-orange-600 px-4 text-xs font-semibold text-white hover:bg-orange-700"
            >
              {isPending
                ? t("orders.dispute.submitting", "Submitting…")
                : t("orders.dispute.submitReport", "Submit Problem Report")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
