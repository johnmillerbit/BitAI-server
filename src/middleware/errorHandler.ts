import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, next: NextFunction) {
    console.error("Error:", err.stack);

    if (res.headersSent) {
        return next(err);
    }

    const errorMessage = err.message || "Internal server error";
    res.status(500).json({ error: errorMessage });
}
