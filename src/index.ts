import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/errorHandler";
import router from "./routes";
import { env } from "./utils/env";
const app = express();
app.use(express.json());
app.use(
    cors({
        origin: [
            "https://bitai.millerbit.biz",
            "http://localhost:3000",
        ],
    })
);

app.use("/", router);
app.use('/uploads', express.static('uploads'));

app.use(errorHandler);

app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
});

process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    process.exit(0);
});

process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    process.exit(0);
});
