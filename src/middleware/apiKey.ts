import { NextFunction, Request, Response } from "express";
import { env } from "../utils/env";
import AppError from "../utils/AppError";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
    const clientKey = req.header("x-api-key");
    if (!env.X_API_KEY || clientKey !== env.X_API_KEY) {
        return next(new AppError("Unauthorized: Invalid or missing API key", 401));
    }
    next();
}
