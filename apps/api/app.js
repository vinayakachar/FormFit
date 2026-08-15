import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import authRoutes from "./src/api/routes/auth.routes.js";
import userRoutes from "./src/api/routes/user.routes.js";
import exerciseRoutes from "./src/api/routes/exercise.routes.js";
import tutorialRoutes from "./src/api/routes/tutorials.routes.js";

const app = express();

dotenv.config();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('AI Fitness Trainer API is running');
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users',userRoutes);
app.use('/api/v1/tutorials',tutorialRoutes);

app.use('/api/v1/exercises',exerciseRoutes);

export default app;