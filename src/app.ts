import express, { NextFunction, Request, Response } from "express";
import globalErrorHandler from "./middlewares/globalErrorHandler";

const app = express();

//Routes

app.get("/", (req, res, next) => {
   res.json({ message: "Welcome to elib apis" });
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
