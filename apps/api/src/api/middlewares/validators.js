import {validationResult,body} from 'express-validator';
import {errorResponse} from '../utils/responseHandler';

const handleValidationErrors=(req,res,next)=>{
    const errors=validationResult(req);
    if(!errors.isEmpty()){
       const errorMessage=errors.array().map((err)=>err.msg).join(', ');
       return errorResponse(res,400,errorMessage);
    }
    next();
}

const validateRegistration=[
    body('name','Name is required').not().isEmpty().trim().escape(),
    body('email','Please provide a valid email').isEmail().normalizeEmail(),
    body('password','Password must be at least 6 characters long').isLength({min:6 }),
    handleValidationErrors
]

const validateLogin=[
    body('email','Please include a valide email').isEmail().normalizeEmail(),
    body('password','Password is required').not().isEmpty(),
    handleValidationErrors
] 

export {validateRegistration,validateLogin};