import mongoose from "mongoose";

import { env } from "../config/env.js";

export function getDatabaseStatus(): "connected" | "disconnected" | "connecting" | "disconnecting" {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "disconnected";
  }
}

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
}
