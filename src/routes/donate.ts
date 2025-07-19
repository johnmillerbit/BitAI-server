import { Router, Request, Response } from "express";
import pool from "../services/db";
import multer from "multer";
import path from "path";
import { asyncHandler } from "../utils/asyncHandler";
import { requireApiKey } from "../middleware/apiKey";
import { allowDonator, getAllDonators, getAllowedDonators, getUnallowedDonators, deleteDonator } from "../services/donator";

// Donator interface
interface Donator {
  id?: number;
  name: string;
  message: string;
  amount?: number; // Optional, not used in DB insert
  file_path: string;
}

// Request body interface
interface DonatorRequestBody {
  name?: string;
  message?: string;
  amount?: string;
}

const UPLOADS_DIR = "uploads";

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `slip-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

/**
 * Multer file filter for images
 */
function imageFileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images (jpg, jpeg, png) are allowed"));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const router = Router();

/**
 * POST /donate - Add a donator with slip image
 */
router.post(
  "/",
  requireApiKey,
  upload.single("slip"),
  asyncHandler(async (req: Request<unknown, unknown, DonatorRequestBody>, res: Response) => {
    const { name, message } = req.body;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Slip image is required" });
      return;
    }
    const filePath = file.path;
    const query = await pool.query<Donator>(
      "INSERT INTO donator (name, message, file_path) VALUES ($1, $2, $3) RETURNING *",
      [name || "Anonymous", message || "", filePath]
    );
    res.status(200).json({
      message: "Donator added successfully",
      donator: query.rows[0],
    });
  })
);

router.put(
  "/:id",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Donator ID is required" });
      return;
    }
    await allowDonator(parseInt(id));
    res.status(200).json({
      message: "Donator updated successfully",
    });
  })
);

router.delete(
  "/:id",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Donator ID is required" });
      return;
    }
    const deletedDonator = await deleteDonator(parseInt(id));
    if (!deletedDonator) {
      res.status(404).json({ error: "Donator not found" });
      return;
    }
    res.status(200).json({
      message: "Donator deleted successfully",
      donator: deletedDonator,
    });
  })
);

router.get(
  "/",
  requireApiKey,
  asyncHandler(async (_req: Request, res: Response) => {
    const donators = await getAllDonators();
    res.status(200).json({
      message: "Donators retrieved successfully",
      donators,
    });
  })
);

router.get(
  "/allowed",
  requireApiKey,
  asyncHandler(async (_req: Request, res: Response) => {
    const donators = await getAllowedDonators();
    res.status(200).json({
      message: "Donators retrieved successfully",
      donators,
    });
  })
);

router.get(
  "/unallowed",
  requireApiKey,
  asyncHandler(async (_req: Request, res: Response) => {
    const donators = await getUnallowedDonators();
    res.status(200).json({
      message: "Donators retrieved successfully",
      donators,
    });
  })
);

export default router;