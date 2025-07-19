import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { asyncHandler } from "../utils/asyncHandler";
import { requireApiKey } from "../middleware/apiKey";
import { allowDonator, getAllDonators, getAllowedDonators, getUnallowedDonators, deleteDonator } from "../services/donator";
import AppError from "../utils/AppError";
import pool from "../services/db"; // Keep pool for now, will refactor donator service later

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
        cb(new AppError("Only images (jpg, jpeg, png) are allowed", 400));
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
            throw new AppError("Slip image is required", 400);
        }

        const filePath = file.path;
        const client = await pool.connect();
        try {
            const query = await client.query<Donator>(
                "INSERT INTO donator (name, message, file_path) VALUES ($1, $2, $3) RETURNING *",
                [name || "Anonymous", message || "", filePath]
            );
            res.status(201).json({
                message: "Donator added successfully",
                donator: query.rows[0],
            });
        } catch (error: any) {
            throw new AppError(`Failed to add donator: ${error.message}`, 500);
        } finally {
            client.release();
        }
    })
);

router.put(
    "/:id",
    requireApiKey,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        if (!id) {
            throw new AppError("Donator ID is required", 400);
        }
        await allowDonator(parseInt(id)); // allowDonator now throws AppError for 404
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
            throw new AppError("Donator ID is required", 400);
        }
        await deleteDonator(parseInt(id)); // deleteDonator now throws AppError for 404
        res.status(200).json({
            message: "Donator deleted successfully",
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
