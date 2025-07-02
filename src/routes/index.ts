
import { Router } from "express";
import documentRouter from "./document";
import chatRouter from "./chat";
import healthRouter from "./health";

const router = Router();

router.use("/add-document", documentRouter);
router.use("/chat", chatRouter);
router.use("/health", healthRouter);

export default router;
