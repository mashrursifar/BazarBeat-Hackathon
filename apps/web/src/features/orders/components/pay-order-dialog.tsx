import { type FormEvent, type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type BuyerOrderCard,
  type BuyerOrderDetail,
  PaymentMethod,
} from "@bazarbeat/shared";

import { Button } from "../../../components/ui/button.js";
import { formatLocalizedPoisha } from "../../../lib/format.js";

export interface PayOrderDialogProps {
  isOpen: boolean;
  order: BuyerOrderCard | BuyerOrderDetail;
  isPending: boolean;
  error?: string | null;
  onPay: (method: PaymentMethod) => Promise<void> | void;
  onClose: () => void;
}

export function PayOrderDialog({
  isOpen,
  order,
  isPending,
  error,
  onPay,
  onClose,
}: PayOrderDialogProps): ReactElement | null {
  const { t, i18n } = useTranslation();
  const isBangla = i18n.language === "bn";

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PaymentMethod.WALLET_SIM);

  if (!isOpen) return null;

  const totalAmount = order.totalAmount;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (selectedMethod === PaymentMethod.COD) {
      // Keeping pay on delivery requires no payment transaction
      onClose();
      return;
    }
    await onPay(selectedMethod);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    >
      <div
        className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="pay-dialog-title" className="text-lg font-bold text-stone-900">
            {t("orders.payment.dialogTitle", "Pay for Order")}
          </h3>
          <span
            data-testid="demo-payment-pill"
            className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800"
          >
            {t("orders.payment.demoBadge", "Demo Payment")}
          </span>
        </div>

        {/* Amount to pay */}
        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            {t("orders.payment.amountDue", "Total Amount Due")}
          </p>
          <p className="mt-1 text-2xl font-black text-primary">
            {formatLocalizedPoisha(totalAmount, isBangla)}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-stone-700">
            {isBangla ? order.cropNameBn : order.cropName} ({order.quantityKg} kg)
          </p>
        </div>

        {/* Demo payment notice - REQUIRED LABEL */}
        <div
          data-testid="demo-payment-banner"
          className="mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900"
        >
          <span className="font-bold text-base" aria-hidden="true">💡</span>
          <div>
            <p className="font-bold">
              {t("orders.payment.demoNoticeTitle", "Demo payment. No real money.")}
            </p>
            <p className="text-[11px] text-blue-800">
              {t(
                "orders.payment.demoNoticeSubtitle",
                "Simulated wallet payment for testing auction order workflows.",
              )}
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
          >
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
          {/* Option 1: Simulated Wallet */}
          <label
            data-testid="payment-option-wallet"
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
              selectedMethod === PaymentMethod.WALLET_SIM
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-stone-200 bg-white hover:bg-stone-50"
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={PaymentMethod.WALLET_SIM}
              checked={selectedMethod === PaymentMethod.WALLET_SIM}
              onChange={() => setSelectedMethod(PaymentMethod.WALLET_SIM)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary"
            />
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900">
                  {t("orders.payment.methodWallet", "Simulated Wallet (Pay now)")}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {t("orders.payment.instantSim", "Instant")}
                </span>
              </div>
              <p className="mt-0.5 text-stone-600">
                {t(
                  "orders.payment.walletDesc",
                  "Instantly settle this order using simulated wallet balance. Demo payment. No real money.",
                )}
              </p>
            </div>
          </label>

          {/* Option 2: Pay on Delivery (Cash) */}
          <label
            data-testid="payment-option-cod"
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
              selectedMethod === PaymentMethod.COD
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-stone-200 bg-white hover:bg-stone-50"
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={PaymentMethod.COD}
              checked={selectedMethod === PaymentMethod.COD}
              onChange={() => setSelectedMethod(PaymentMethod.COD)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary"
            />
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900">
                  {t("orders.payment.methodCod", "Keep pay on delivery (Cash)")}
                </span>
                <span className="text-[11px] font-semibold text-stone-500">
                  {t("orders.payment.cashHandover", "At Handover")}
                </span>
              </div>
              <p className="mt-0.5 text-stone-600">
                {t(
                  "orders.payment.codDesc",
                  "Pay cash in hand directly to the farmer when picking up the produce.",
                )}
              </p>
            </div>
          </label>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="bg-stone-100 text-stone-800 hover:bg-stone-200"
              onClick={onClose}
              disabled={isPending}
            >
              {t("orders.payment.closeButton", "Close")}
            </Button>

            {selectedMethod === PaymentMethod.WALLET_SIM ? (
              <Button
                type="submit"
                data-testid="confirm-wallet-pay-btn"
                className="bg-primary text-white hover:bg-primary/90"
                disabled={isPending}
              >
                {isPending
                  ? t("orders.payment.processing", "Processing payment…")
                  : t("orders.payment.payNowButton", "Pay Now (Demo Wallet)")}
              </Button>
            ) : (
              <Button
                type="submit"
                data-testid="keep-cod-btn"
                className="bg-stone-800 text-white hover:bg-stone-900"
                disabled={isPending}
              >
                {t("orders.payment.keepCodButton", "Keep Pay on Delivery")}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
