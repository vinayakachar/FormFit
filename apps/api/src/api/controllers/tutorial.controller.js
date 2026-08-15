import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/responseHandler.js";
import Tutorial from "../../models/Tutorial.model.js";

const getTutorials=asyncHandler(async(req,res)=>{
        const tutorials= await Tutorial.find({}).sort({order:'asc'});

        if(!tutorials || tutorials.length===0){
            return successResponse(res,404,{message:"No tutorial found"});
        }

        return successResponse(res,200,{
            message:"Tutorials retrieved ",
            data:tutorials
        })

})

export {getTutorials};