import Workout from "../../models/Workout.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/responseHandler.js";


const getProgressAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { period = 'weekly' } = req.query; 
    let startDate;

    if (period.toLowerCase() === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    } else { // Default to weekly
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    }

    const workouts = await Workout.find({
        user: userId,
        status: 'completed',
        endTime: { $gte: startDate }
    }).populate('exercises.exercise');

    if (!workouts || workouts.length === 0) {
        return successResponse(res, 200, {
            message: "No workout data found for the selected period.",
            analytics: {
                caloriesBurnedTrend: [],
                repsVolumeTrend: [],
                accuracyTrend: [],
                bestScore: null,
                totalWorkouts: 0,
            }
        });
    }

    const analytics = {
        caloriesBurnedTrend: {},
        repsVolumeTrend: {},
        accuracyTrend: {},
        bestScore: { score: 0, exercise: null, date: null },
        totalWorkouts: workouts.length,
    };

    workouts.forEach(workout => {
        const dateKey = workout.endTime.toISOString().split('T')[0]; // Group by day (YYYY-MM-DD)

        if (!analytics.caloriesBurnedTrend[dateKey]) analytics.caloriesBurnedTrend[dateKey] = 0;
        if (!analytics.repsVolumeTrend[dateKey]) analytics.repsVolumeTrend[dateKey] = 0;
        if (!analytics.accuracyTrend[dateKey]) analytics.accuracyTrend[dateKey] = { totalScore: 0, count: 0 };

        analytics.caloriesBurnedTrend[dateKey] += workout.caloriesBurned;

        let workoutTotalScore = 0;
        let exerciseCount = 0;

        workout.exercises.forEach(ex => {
            const volume = (ex.reps || 0) * (ex.sets || 0);
            analytics.repsVolumeTrend[dateKey] += volume;

            if (ex.formScore) {
                workoutTotalScore += ex.formScore;
                exerciseCount++;
            }
            
            if (ex.formScore > analytics.bestScore.score) {
                analytics.bestScore = {
                    score: ex.formScore,
                    exercise: ex.exercise.name,
                    date: workout.endTime
                };
            }
        });
        
        if(exerciseCount > 0) {
            analytics.accuracyTrend[dateKey].totalScore += workoutTotalScore;
            analytics.accuracyTrend[dateKey].count += exerciseCount;
        }
    });

    const formattedAnalytics = {
        caloriesBurnedTrend: Object.keys(analytics.caloriesBurnedTrend).map(date => ({
            date,
            value: analytics.caloriesBurnedTrend[date]
        })).sort((a, b) => new Date(a.date) - new Date(b.date)),

        repsVolumeTrend: Object.keys(analytics.repsVolumeTrend).map(date => ({
            date,
            value: analytics.repsVolumeTrend[date]
        })).sort((a, b) => new Date(a.date) - new Date(b.date)),

        accuracyTrend: Object.keys(analytics.accuracyTrend).map(date => ({
            date,
            value: analytics.accuracyTrend[date].count > 0 ? (analytics.accuracyTrend[date].totalScore / analytics.accuracyTrend[date].count) : 0
        })).sort((a, b) => new Date(a.date) - new Date(b.date)),

        bestScore: analytics.bestScore.exercise ? analytics.bestScore : null,
        totalWorkouts: analytics.totalWorkouts,
    };

    return successResponse(res, 200, {
        message: "Progress analytics retrieved successfully.",
        analytics: formattedAnalytics
    });
});

export {getProgressAnalytics};
