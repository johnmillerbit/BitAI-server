
import { Router } from "express";
import documentRouter from "./document";
import chatRouter from "./chat";
import healthRouter from "./health";
import donateRouter from "./donate";


const router = Router();

router.use("/add-document", documentRouter);
router.use("/chat", chatRouter);
router.use("/health", healthRouter);
router.use("/donate", donateRouter);

export default router;
