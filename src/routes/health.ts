
import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response): void => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

export default router;
