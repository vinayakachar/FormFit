import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { globalErrorHandler } from "./src/api/middlewares/errorHandler.js";
import authRoutes from "./src/api/routes/auth.routes.js";
import userRoutes from "./src/api/routes/user.routes.js";
import exerciseRoutes from "./src/api/routes/exercise.routes.js";
import tutorialRoutes from "./src/api/routes/tutorials.routes.js";
import workoutRoutes from "./src/api/routes/workout.routes.js";
import dietRoutes from "./src/api/routes/diet.routes.js";
import historyRoutes from "./src/api/routes/history.routes.js";
import planRoutes from "./src/api/routes/plan.routes.js";
import progressRoutes from "./src/api/routes/progress.routes.js";


const app = express();

dotenv.config();

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;
    if (origin.endsWith(".vercel.app")) return true;
    if (process.env.CLIENT_URL) {
        if (process.env.CLIENT_URL === "*") return true;
        const list = process.env.CLIENT_URL.split(',').map(s => s.trim());
        if (list.includes(origin)) return true;
    }
    return true;
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Range"],
    exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length", "Content-Disposition"]
}));
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(express.json());


app.get('/', (req, res) => {
    res.send('AI Fitness Trainer API is running');
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users',userRoutes);
app.use('/api/v1/tutorials',tutorialRoutes);

app.use('/api/v1/exercises',exerciseRoutes);
app.use('/api/v1/workouts',workoutRoutes);
app.use('/api/v1/diet',dietRoutes);
app.use('/api/v1/history',historyRoutes);

app.use('/api/v1/plans',planRoutes);
app.use('/api/v1/progress',progressRoutes);

app.use(globalErrorHandler);

export default app;