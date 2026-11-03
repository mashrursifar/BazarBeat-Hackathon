export const UserRole = {
  FARMER: "FARMER",
  BUYER: "BUYER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Language = {
  EN: "en",
  BN: "bn",
} as const;

export type Language = (typeof Language)[keyof typeof Language];

export const CropGrade = {
  A: "A",
  B: "B",
  C: "C",
} as const;

export type CropGrade = (typeof CropGrade)[keyof typeof CropGrade];
