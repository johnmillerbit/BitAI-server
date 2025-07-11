import { Router, Request, Response } from "express";
import pool from "../services/db";
import multer from "multer";
import path from "path";
import fs from "fs";
import { X_API_KEY } from "../utils/env";

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
 * Ensure uploads directory exists
 */
function ensureUploadsDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

ensureUploadsDir(UPLOADS_DIR);

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

/**
 * Middleware to check for X-API-KEY header
 */
function requireApiKey(req: Request, res: Response, next: () => void) {
  const apiKey = X_API_KEY;
  const clientKey = req.header("x-api-key");
  if (!apiKey || clientKey !== apiKey) {
    res.status(401).json({ error: "Unauthorized: Invalid or missing API key" });
    return;
  }
  next();
}

const router = Router();

/**
 * POST /donate - Add a donator with slip image
 */
router.post(
  "/",
  requireApiKey,
  upload.single("slip"),
  async (req: Request<unknown, unknown, DonatorRequestBody>, res: Response): Promise<void> => {
    try {
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
    } catch (error) {
      console.error("Error in /donate:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add donator";
      res.status(500).json({ error: errorMessage });
    }
  }
);

/**
 * GET /donate - Retrieve all donators
 */
router.get(
  "/",
  requireApiKey,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const query = await pool.query<Donator>("SELECT * FROM donator order by id desc");
      res.status(200).json({
        message: "Donators retrieved successfully",
        donators: query.rows,
      });
    } catch (error) {
      console.error("Error in /donate:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to retrieve donators";
      res.status(500).json({ error: errorMessage });
    }
  }
);

export default router;