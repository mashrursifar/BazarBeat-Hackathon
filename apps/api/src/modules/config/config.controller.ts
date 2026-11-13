import type { RequestHandler } from "express";
import {
  DEMO_LISTING_DURATION_PRESET_MINUTES,
  LISTING_DURATION_PRESETS,
  type PublicConfigResponse,
} from "@bazarbeat/shared";

import { env } from "../../config/env.js";

export const getConfigController: RequestHandler<
  Record<string, string>,
  PublicConfigResponse
> = (_request, response): void => {
  response.status(200).json({
    data: {
      demoMode: env.DEMO_MODE,
      durationPresets: {
        ...LISTING_DURATION_PRESETS,
        ...(env.DEMO_MODE ? { DEMO: DEMO_LISTING_DURATION_PRESET_MINUTES } : {}),
      },
      platformFeeBps: env.PLATFORM_FEE_BPS,
    },
  });
};
