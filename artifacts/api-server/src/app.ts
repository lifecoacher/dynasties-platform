import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import healthRouter from "./routes/health.js";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", healthRouter);
app.use("/api", authRouter);
app.use("/api", adminRouter);
app.use("/api", router);

export default app;
