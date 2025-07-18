import express from "express";
import cors from "cors";
import { PORT } from "./utils/env";
import router from "./routes";
import { errorHandler } from "./middleware/errorHandler";

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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    process.exit(0);
});

process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    process.exit(0);
});
