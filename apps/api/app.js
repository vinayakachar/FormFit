import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('AI Fitness Trainer API is running');
});


export default app;