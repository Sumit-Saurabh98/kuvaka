import { Request, Response, NextFunction } from "express";


interface ApiError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
    public statusCode?: number | undefined;
    public isOperational?: boolean | undefined;

    constructor(message: string, statusCode: number = 500){
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export const globalErrorHandler = (err: ApiError, req: Request, res:Response, next: NextFunction) =>{

    err.statusCode = err.statusCode || 500;
    err.message = err.message || 'Something went wrong!';

    console.log("Error 💥", err)

    if(err.isOperational){
        return res.status(err.statusCode).json({
            status: 'fail',
            messsage: err.message
        })
    }else{
        return res.status(500).json({
            status: 'error',
            message: 'Something went wrong!'
        })
    }
}

// Utility to wrap async functions for error handling

export const catchAsync = (fn: Function) =>{
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    }
}
