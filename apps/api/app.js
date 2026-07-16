import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import authRoutes from "./src/api/routes/auth.routes.js";

const app = express();

dotenv.config();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('AI Fitness Trainer API is running');
});

app.use('/api/v1/auth', authRoutes);


export default app;