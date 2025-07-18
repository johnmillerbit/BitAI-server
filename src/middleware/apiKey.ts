import { Request, Response, NextFunction } from "express";
import { X_API_KEY } from "../utils/env";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = X_API_KEY;
  const clientKey = req.header("x-api-key");
  if (!apiKey || clientKey !== apiKey) {
    res.status(401).json({ error: "Unauthorized: Invalid or missing API key" });
    return;
  }
  next();
}
