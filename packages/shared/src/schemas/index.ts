import { z } from "zod";

import { CropGrade, UserRole } from "../enums.js";

export const userRoleSchema = z.enum([UserRole.FARMER, UserRole.BUYER]);
export const cropGradeSchema = z.enum([CropGrade.A, CropGrade.B, CropGrade.C]);
export * from "./auth.js";
export * from "./catalog-inventory.js";
