
import { Router } from "express";

import chatRouter from "./chat";
import documentRouter from "./document";
import donateRouter from "./donate";
import healthRouter from "./health";

const router = Router();

router.use("/add-document", documentRouter);
router.use("/chat", chatRouter);
router.use("/health", healthRouter);
router.use("/donate", donateRouter);

export default router;
