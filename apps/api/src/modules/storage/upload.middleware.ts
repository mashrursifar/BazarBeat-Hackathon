import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { AppError } from "../../shared/errors.js";

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 4,
  },
});

export const uploadImagesMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  multerUpload.array("images", 4)(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError(400, "VALIDATION_ERROR", "Image size exceeds 5 MB limit"));
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(new AppError(400, "VALIDATION_ERROR", "Maximum 4 images allowed"));
        }
        return next(new AppError(400, "VALIDATION_ERROR", err.message));
      }
      return next(err);
    }
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return next(new AppError(400, "VALIDATION_ERROR", "At least one image is required"));
    }
    if (files.length > 4) {
      return next(new AppError(400, "VALIDATION_ERROR", "Maximum 4 images allowed"));
    }
    next();
  });
};
