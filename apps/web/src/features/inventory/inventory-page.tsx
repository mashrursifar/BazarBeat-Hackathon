import { type InventorySummaryItem, type StockMovementResponse, addStockRequestSchema } from "@bazarbeat/shared";
import { type FormEvent, type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTable, EmptyState, ErrorState, StatCard } from "../../components/shared/data-states.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Select } from "../../components/ui/select.js";
import { useAddStock, useInventory, useInventoryMovements } from "./api/use-inventory.js";

export function AddStockDialog({ crops, onClose, onAdd }: { crops: InventorySummaryItem[]; onClose: () => void; onAdd: (input: { cropId: string; quantityKg: number; note?: string }) => Promise<void> }): ReactElement {
  const { t, i18n } = useTranslation();
  const [cropId, setCropId] = useState(crops[0]?.crop.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError("");
    const parsed = addStockRequestSchema.safeParse({ cropId, quantityKg: Number(quantity), ...(note.trim() ? { note: note.trim() } : {}) });
    if (!parsed.success) { setError(t("inventory.validation")); return; }
    setPending(true);
    try { await onAdd(parsed.data); onClose(); } catch { setError(t("inventory.addError")); } finally { setPending(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="add-stock-title" className="w-full max-w-lg rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl"><h2 id="add-stock-title" className="text-xl font-bold">{t("inventory.addTitle")}</h2><form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)} data-testid="add-stock-form">
    <label className="block text-sm font-medium">{t("inventory.crop")}<Select data-testid="stock-crop" value={cropId} onChange={(event) => setCropId(event.target.value)} required>{crops.map((item) => <option key={item.crop.id} value={item.crop.id}>{i18n.language === "bn" ? item.crop.nameBn : item.crop.nameEn}</option>)}</Select></label>
    <label className="block text-sm font-medium">{t("inventory.quantity")}<span className="mt-1 flex items-center gap-2"><Input data-testid="stock-quantity" type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /><span aria-label={t("inventory.kilograms")} className="shrink-0 rounded-md bg-stone-100 px-3 py-3">kg</span></span></label>
    <label className="block text-sm font-medium">{t("inventory.noteOptional")}<Input data-testid="stock-note" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" className="bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 sm:w-auto" onClick={onClose}>{t("inventory.cancel")}</Button><Button data-testid="stock-submit" disabled={pending} className="sm:w-auto">{pending ? t("inventory.saving") : t("inventory.addStock")}</Button></div>
  </form></section></div>;
}

export function MovementHistory({ cropId, page, onPageChange }: { cropId: string; page: number; onPageChange: (page: number) => void }): ReactElement {
  const { t, i18n } = useTranslation();
  const query = useInventoryMovements(cropId, { page, limit: 10 });
  if (query.isLoading) return <div role="status" className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded bg-stone-200" />)}</div>;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.data.length === 0) return <EmptyState title={t("inventory.noMovements")} />;
  const movementLabel = (movement: StockMovementResponse): string => t(`inventory.types.${movement.type}`);
  const dateFormatter = new Intl.DateTimeFormat(i18n.language === "bn" ? "bn-BD" : "en-BD", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const maxPage = Math.max(1, Math.ceil(query.data.meta.total / query.data.meta.limit));
  return <div data-testid="movement-history"><DataTable label={t("inventory.historyTitle")}><thead><tr className="border-b bg-stone-50"><th className="p-3">{t("inventory.movement")}</th><th className="p-3">{t("inventory.quantity")}</th><th className="p-3">{t("inventory.date")}</th></tr></thead><tbody>{query.data.data.map((movement) => <tr key={movement.id} className="border-b last:border-0"><td className="p-3">{movementLabel(movement)}{movement.note && <span className="block text-xs text-muted-foreground">{movement.note}</span>}</td><td className="p-3">{movement.quantityKg} kg</td><td className="p-3">{dateFormatter.format(new Date(movement.createdAt))}</td></tr>)}</tbody></DataTable><div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm">{t("inventory.page", { page, maxPage })}</span><div className="flex gap-2"><button data-testid="history-previous" className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{t("inventory.previous")}</button><button data-testid="history-next" className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={page >= maxPage} onClick={() => onPageChange(page + 1)}>{t("inventory.next")}</button></div></div></div>;
}

export default function InventoryPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const inventory = useInventory();
  const addStock = useAddStock();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  if (inventory.isLoading) return <section aria-label={t("inventory.title")} role="status" className="space-y-4"><div className="h-9 w-48 animate-pulse rounded bg-stone-200" /><div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded bg-stone-200" />)}</div></section>;
  if (inventory.isError) return <ErrorState onRetry={() => void inventory.refetch()} />;
  const crops = inventory.data ?? [];
  const totals = crops.reduce((result, item) => ({ available: result.available + item.availableKg, listed: result.listed + item.listedKg, sold: result.sold + item.soldKg }), { available: 0, listed: 0, sold: 0 });
  return <section data-testid="inventory-page" className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold sm:text-3xl">{t("inventory.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("inventory.description")}</p></div><Button data-testid="add-stock-open" className="w-auto" onClick={() => setDialogOpen(true)}>{t("inventory.addStock")}</Button></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><StatCard label={t("inventory.available")} value={`${totals.available} kg`} /><StatCard label={t("inventory.listed")} value={`${totals.listed} kg`} /><StatCard label={t("inventory.sold")} value={`${totals.sold} kg`} /></div>
    {crops.length === 0 ? <EmptyState title={t("inventory.noCrops")} action={<button className="min-h-11 rounded bg-primary px-4 text-white" onClick={() => setDialogOpen(true)}>{t("inventory.addStock")}</button>} /> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{crops.map((item) => <button key={item.crop.id} data-testid={`crop-${item.crop.slug}`} onClick={() => { setSelectedCrop(item.crop.id); setHistoryPage(1); }} className={`rounded-lg border bg-white p-4 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedCrop === item.crop.id ? "border-primary ring-1 ring-primary" : "border-stone-200"}`}><span className="block text-lg font-semibold">{i18n.language === "bn" ? item.crop.nameBn : item.crop.nameEn}</span><span className="mt-3 grid grid-cols-3 gap-2 text-sm"><span>{t("inventory.availableShort")}<strong className="block">{item.availableKg} kg</strong></span><span>{t("inventory.listedShort")}<strong className="block">{item.listedKg} kg</strong></span><span>{t("inventory.soldShort")}<strong className="block">{item.soldKg} kg</strong></span></span></button>)}</div>}
    {crops.length > 0 && <section className="space-y-3"><h2 className="text-xl font-bold">{t("inventory.historyTitle")}{selectedCrop && <span className="font-normal text-muted-foreground"> — {((): string => { const crop = crops.find((item) => item.crop.id === selectedCrop)?.crop; return crop ? (i18n.language === "bn" ? crop.nameBn : crop.nameEn) : ""; })()}</span>}</h2><div className="flex flex-wrap gap-2" aria-label={t("inventory.chooseHistoryCrop")}>{crops.map((item) => <button key={item.crop.id} className={`min-h-11 rounded-full border px-4 ${selectedCrop === item.crop.id ? "border-primary bg-green-50" : "border-stone-300"}`} onClick={() => { setSelectedCrop(item.crop.id); setHistoryPage(1); }}>{i18n.language === "bn" ? item.crop.nameBn : item.crop.nameEn}</button>)}</div><MovementHistory cropId={selectedCrop || crops[0]?.crop.id || ""} page={historyPage} onPageChange={setHistoryPage} /></section>}
    {dialogOpen && <AddStockDialog crops={crops} onClose={() => setDialogOpen(false)} onAdd={async (input) => { await addStock.mutateAsync(input); }} />}
  </section>;
}
