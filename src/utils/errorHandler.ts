import { Request, Response, NextFunction } from "express";

interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// --- custom AppError class ---
export class AppError extends Error implements ApiError {
  public statusCode?: number | undefined;
  public isOperational?: boolean | undefined;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    // This line helps keep the stack trace clean by not including the constructor itself.
    Error.captureStackTrace(this, this.constructor);
  }
}

// --- The Global Error Handler Middleware ---
export const globalErrorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Something went wrong!";

  console.log("Error 💥", err);

  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: "fail",
      messsage: err.message,
    });
  } else {
    res.status(500).json({
      status: "error",
      message: "Something went wrong!",
    });
  }
};

// Utility to wrap async functions for error handling
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
