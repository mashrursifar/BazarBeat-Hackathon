import {
  type ReactElement,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  AssessmentResult,
  CropResponse,
  FarmerListing,
  PriceGuidance,
} from "@bazarbeat/shared";

export const WIZARD_DRAFT_KEY = "bazarbeat_listing_wizard_draft";

export interface WizardError {
  code: string;
  message: string;
}

export interface ListingWizardState {
  step: number;
  selectedCrop: CropResponse | null;
  photos: File[];
  assessmentResult: AssessmentResult | null;
  assessmentError: WizardError | null;
  priceGuidance: PriceGuidance | null;
  floorPricePerKg: number;
  localSellingCostPerKg: number;
  quantityKg: number;
  durationMinutes: number;
  pickupNote: string;
  createdListing: FarmerListing | null;

  setStep: (step: number) => void;
  setSelectedCrop: (crop: CropResponse) => void;
  setPhotos: (photos: File[]) => void;
  setAssessmentResult: (result: AssessmentResult | null) => void;
  setAssessmentError: (error: WizardError | null) => void;
  setPriceGuidance: (guidance: PriceGuidance | null) => void;
  setFloorPricePerKg: (poisha: number) => void;
  setLocalSellingCostPerKg: (poisha: number) => void;
  setQuantityKg: (kg: number) => void;
  setDurationMinutes: (minutes: number) => void;
  setPickupNote: (note: string) => void;
  setCreatedListing: (listing: FarmerListing | null) => void;
  retakePhotos: () => void;
  clearDraft: () => void;
  reset: () => void;
}

const ListingWizardContext = createContext<ListingWizardState | null>(null);

export interface ListingWizardDraftData {
  step: number;
  selectedCrop: CropResponse | null;
  assessmentResult: AssessmentResult | null;
  priceGuidance: PriceGuidance | null;
  floorPricePerKg: number;
  localSellingCostPerKg: number;
  quantityKg: number;
  durationMinutes: number;
  pickupNote: string;
}

export function loadSavedDraft(): Partial<ListingWizardDraftData> | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ListingWizardDraftData>;

    // Restore draft ONLY if the assessment token has not expired (TTL 30 min)
    if (parsed.assessmentResult?.assessedAt) {
      const assessedAt = new Date(parsed.assessmentResult.assessedAt).getTime();
      const elapsed = Date.now() - assessedAt;
      if (elapsed > 30 * 60 * 1000) {
        window.sessionStorage.removeItem(WIZARD_DRAFT_KEY);
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface ListingWizardProviderProps {
  children: ReactNode;
  initialStep?: number;
  initialCrop?: CropResponse | null;
  initialPhotos?: File[];
  initialAssessment?: AssessmentResult | null;
  initialError?: WizardError | null;
  initialPriceGuidance?: PriceGuidance | null;
  initialFloorPricePerKg?: number;
  initialQuantityKg?: number;
  initialDurationMinutes?: number;
  initialPickupNote?: string;
  skipStorageRestoration?: boolean;
}

export function ListingWizardProvider({
  children,
  initialStep,
  initialCrop,
  initialPhotos = [],
  initialAssessment,
  initialError = null,
  initialPriceGuidance,
  initialFloorPricePerKg,
  initialQuantityKg,
  initialDurationMinutes,
  initialPickupNote,
  skipStorageRestoration = false,
}: ListingWizardProviderProps): ReactElement {
  const savedDraft = skipStorageRestoration ? null : loadSavedDraft();

  const [step, setStep] = useState<number>(
    initialStep ?? savedDraft?.step ?? 1,
  );
  const [selectedCrop, setSelectedCrop] = useState<CropResponse | null>(
    initialCrop ?? savedDraft?.selectedCrop ?? null,
  );
  const [photos, setPhotos] = useState<File[]>(initialPhotos);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(
    initialAssessment ?? savedDraft?.assessmentResult ?? null,
  );
  const [assessmentError, setAssessmentError] = useState<WizardError | null>(initialError);

  const [priceGuidance, setPriceGuidance] = useState<PriceGuidance | null>(
    initialPriceGuidance ?? savedDraft?.priceGuidance ?? null,
  );
  const [floorPricePerKg, setFloorPricePerKg] = useState<number>(
    initialFloorPricePerKg ?? savedDraft?.floorPricePerKg ?? 0,
  );
  const [localSellingCostPerKg, setLocalSellingCostPerKg] = useState<number>(
    savedDraft?.localSellingCostPerKg ?? 0,
  );
  const [quantityKg, setQuantityKg] = useState<number>(
    initialQuantityKg ?? savedDraft?.quantityKg ?? 0,
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    initialDurationMinutes ?? savedDraft?.durationMinutes ?? 360,
  );
  const [pickupNote, setPickupNote] = useState<string>(
    initialPickupNote ?? savedDraft?.pickupNote ?? "",
  );
  const [createdListing, setCreatedListing] = useState<FarmerListing | null>(null);

  // Mirror non-sensitive wizard state to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    if (!selectedCrop && !assessmentResult && step === 1) return;

    const draftData: ListingWizardDraftData = {
      step,
      selectedCrop,
      assessmentResult,
      priceGuidance,
      floorPricePerKg,
      localSellingCostPerKg,
      quantityKg,
      durationMinutes,
      pickupNote,
    };

    try {
      window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draftData));
    } catch {
      // Ignore sessionStorage exceptions
    }
  }, [
    step,
    selectedCrop,
    assessmentResult,
    priceGuidance,
    floorPricePerKg,
    localSellingCostPerKg,
    quantityKg,
    durationMinutes,
    pickupNote,
  ]);

  const clearDraft = (): void => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(WIZARD_DRAFT_KEY);
    }
  };

  const retakePhotos = (): void => {
    setAssessmentResult(null);
    setAssessmentError(null);
    setPriceGuidance(null);
    setFloorPricePerKg(0);
    setStep(2);
  };

  const reset = (): void => {
    clearDraft();
    setStep(1);
    setSelectedCrop(null);
    setPhotos([]);
    setAssessmentResult(null);
    setAssessmentError(null);
    setPriceGuidance(null);
    setFloorPricePerKg(0);
    setLocalSellingCostPerKg(0);
    setQuantityKg(0);
    setDurationMinutes(360);
    setPickupNote("");
    setCreatedListing(null);
  };

  const value = useMemo<ListingWizardState>(
    () => ({
      step,
      selectedCrop,
      photos,
      assessmentResult,
      assessmentError,
      priceGuidance,
      floorPricePerKg,
      localSellingCostPerKg,
      quantityKg,
      durationMinutes,
      pickupNote,
      createdListing,

      setStep,
      setSelectedCrop,
      setPhotos,
      setAssessmentResult,
      setAssessmentError,
      setPriceGuidance,
      setFloorPricePerKg,
      setLocalSellingCostPerKg,
      setQuantityKg,
      setDurationMinutes,
      setPickupNote,
      setCreatedListing,
      retakePhotos,
      clearDraft,
      reset,
    }),
    [
      step,
      selectedCrop,
      photos,
      assessmentResult,
      assessmentError,
      priceGuidance,
      floorPricePerKg,
      localSellingCostPerKg,
      quantityKg,
      durationMinutes,
      pickupNote,
      createdListing,
    ],
  );

  return (
    <ListingWizardContext.Provider value={value}>
      {children}
    </ListingWizardContext.Provider>
  );
}

export function useListingWizard(): ListingWizardState {
  const context = useContext(ListingWizardContext);
  if (!context) {
    throw new Error("useListingWizard must be used within a ListingWizardProvider");
  }
  return context;
}
