export interface CropSeed {
  slug: string;
  nameEn: string;
  nameBn: string;
  unit: "KG";
  minLotKg: number;
  maxLotKg: number;
  shelfLifeHours: number;
  gradeGuide: { A: string; B: string; C: string };
  minIncrementPerKg: number;
  imageUrl: string;
  isActive: true;
}

const PLACEHOLDER_IMAGE = "/images/crops/placeholder.svg";

export const CROP_SEED_DATA: readonly CropSeed[] = [
  {
    slug: "onion",
    nameEn: "Onion",
    nameBn: "পেঁয়াজ",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 2_000,
    shelfLifeHours: 720,
    gradeGuide: { A: "Firm, dry bulbs with intact skin", B: "Mostly firm bulbs with minor marks", C: "Small or uneven bulbs, still sound" },
    minIncrementPerKg: 100,
    imageUrl: PLACEHOLDER_IMAGE,
    isActive: true,
  },
  {
    slug: "green-chilli",
    nameEn: "Green Chilli",
    nameBn: "কাঁচা মরিচ",
    unit: "KG",
    minLotKg: 5,
    maxLotKg: 500,
    shelfLifeHours: 72,
    gradeGuide: { A: "Fresh, firm, bright green pods", B: "Fresh pods with slight bends or marks", C: "Mixed sizes, usable with minor softness" },
    minIncrementPerKg: 100,
    imageUrl: PLACEHOLDER_IMAGE,
    isActive: true,
  },
  {
    slug: "bitter-gourd",
    nameEn: "Bitter Gourd",
    nameBn: "করলা",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 1_000,
    shelfLifeHours: 120,
    gradeGuide: { A: "Firm, green fruit with defined ridges", B: "Mostly firm fruit with minor marks or uneven color", C: "Mature fruit with some yellowing, still sound and usable" },
    minIncrementPerKg: 100,
    imageUrl: PLACEHOLDER_IMAGE,
    isActive: true,
  },
  {
    slug: "eggplant",
    nameEn: "Eggplant",
    nameBn: "বেগুন",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 1_000,
    shelfLifeHours: 120,
    gradeGuide: { A: "Glossy, firm fruit with fresh green caps", B: "Firm fruit with small scratches or marks", C: "Mixed sizes, usable with slight dullness" },
    minIncrementPerKg: 100,
    imageUrl: PLACEHOLDER_IMAGE,
    isActive: true,
  },
  {
    slug: "potato",
    nameEn: "Potato",
    nameBn: "আলু",
    unit: "KG",
    minLotKg: 10,
    maxLotKg: 2_000,
    shelfLifeHours: 720,
    gradeGuide: { A: "Firm, clean tubers with no green patches", B: "Firm tubers with minor scuffs or irregular shapes", C: "Small or uneven tubers, sound and usable" },
    minIncrementPerKg: 100,
    imageUrl: PLACEHOLDER_IMAGE,
    isActive: true,
  },
];
