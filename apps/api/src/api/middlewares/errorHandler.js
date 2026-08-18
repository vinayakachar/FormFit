import { errorResponse } from "../../utils/responseHandler.js"

const globalErrorHandler=(err,req,res,next)=>{
    console.error('UNHANDLEDERROR:',err.stack);

      const message = process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred on the server.'
        : err.message;

    errorResponse(res, err.statusCode || 500, message);
}

export {globalErrorHandler};