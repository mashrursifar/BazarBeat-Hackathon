import mongoose, { type InferSchemaType } from "mongoose";

const gradeGuideSchema = new mongoose.Schema(
  {
    A: { type: String, required: true },
    B: { type: String, required: true },
    C: { type: String, required: true },
  },
  { _id: false },
);

const cropSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    nameEn: { type: String, required: true, trim: true },
    nameBn: { type: String, required: true, trim: true },
    unit: { type: String, enum: ["KG"], default: "KG", required: true },
    minLotKg: { type: Number, required: true, min: 1 },
    maxLotKg: { type: Number, required: true, min: 1 },
    shelfLifeHours: { type: Number, required: true, min: 1 },
    gradeGuide: { type: gradeGuideSchema, required: true },
    minIncrementPerKg: {
      type: Number,
      required: true,
      default: 100,
      min: 1,
      validate: { validator: Number.isInteger, message: "Minimum increment must be integer poisha" },
    },
    imageUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, collection: "crops", versionKey: false },
);

export type CropRecord = InferSchemaType<typeof cropSchema>;
export const Crop = mongoose.models.Crop
  ? mongoose.model<CropRecord>("Crop")
  : mongoose.model<CropRecord>("Crop", cropSchema);
