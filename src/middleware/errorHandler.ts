import { NextFunction, Request, Response } from "express";
import AppError from "../utils/AppError";
import { env } from "../utils/env";

const sendErrorDev = (err: AppError, res: Response) => {
    console.error("Error:", err.stack);
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};

const sendErrorProd = (err: AppError, res: Response) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    } else {
        // Programming or other unknown error: don't leak error details
        console.error("ERROR 💥", err);
        res.status(500).json({
            status: "error",
            message: "Something went very wrong!",
        });
    }
};

export function errorHandler(err: AppError, _req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err);
    }

    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";

    if (env.NODE_ENV === "development") {
        sendErrorDev(err, res);
    } else if (env.NODE_ENV === "production") {
        sendErrorProd(err, res);
    }
}
