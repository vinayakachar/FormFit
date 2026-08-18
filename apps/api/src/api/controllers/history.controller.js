import Workout from "../../models/Workout.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse,errorResponse } from "../../utils/responseHandler.js";

const getWorkoutHistory=asyncHandler(async(req,res)=>{
    const userId=req.user.id;
    const {page=1,limit=10}=req.query;

    const options={
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { endTime: -1 }, 
        populate: 'exercises.exercise',
        lean: true,
    }

    const query = { user: userId, status: 'completed' };

    const result = await Workout.paginate(query, options);

    if (!result.docs || result.docs.length === 0) {
        return successResponse(res, 200, { message: "No workout history found.", docs: [] });
    }

    return successResponse(res, 200, { message: "Workout history retrieved successfully.", ...result });

});

const getWorkoutById = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workoutId } = req.params;

    const workout = await Workout.findOne({
        _id: workoutId,
        user: userId, 
        status: 'completed'
    }).populate('exercises.exercise');

    if (!workout) {
        return errorResponse(res, 404, "Workout not found in your history.");
    }

    return successResponse(res, 200, { message: "Workout details retrieved successfully.", workout });
});

const deleteWorkout = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workoutId } = req.params;

    const workout = await Workout.findOneAndDelete({
        _id: workoutId,
        user: userId 
    });

    if (!workout) {
        return errorResponse(res, 404, "Workout not found in your history.");
    }

    return successResponse(res, 200, { message: "Workout successfully deleted from your history." });
});

export {getWorkoutHistory,getWorkoutById,deleteWorkout};