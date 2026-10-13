import Workout from "../../models/Workout.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/responseHandler.js";


const getProgressAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { period = 'weekly' } = req.query;
    const now = new Date();
    let startDate;

    if (String(period).toLowerCase() === 'monthly') {
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

const getDashboardStats = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7));

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const monthStart = new Date(currentWeekStart);
    monthStart.setDate(monthStart.getDate() - 21);

    const workouts = await Workout.find({
        user: req.user.id,
        status: 'completed',
        endTime: { $gte: monthStart },
    }).select('endTime duration caloriesBurned exercises').lean();

    const weeklyReps = Array(7).fill(0);
    const monthlyCalories = Array(4).fill(0);
    const currentWeek = { calories: 0, reps: 0, minutes: 0, scores: [] };
    const previousWeek = { calories: 0, reps: 0, minutes: 0 };
    const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;

    workouts.forEach((workout) => {
        const date = new Date(workout.endTime);
        const calories = Number(workout.caloriesBurned) || 0;
        const reps = (workout.exercises || []).reduce(
            (total, exercise) => total + (Number(exercise.reps) || 0) * (Number(exercise.sets) || 0),
            0,
        );
        const duration = Number(workout.duration) || 0;
        const weekIndex = Math.floor((date.getTime() - monthStart.getTime()) / weekInMilliseconds);

        if (weekIndex >= 0 && weekIndex < monthlyCalories.length) {
            monthlyCalories[weekIndex] += calories;
        }

        if (date >= currentWeekStart) {
            const dayIndex = (date.getDay() + 6) % 7;
            weeklyReps[dayIndex] += reps;
            currentWeek.calories += calories;
            currentWeek.reps += reps;
            currentWeek.minutes += duration;
            (workout.exercises || []).forEach((exercise) => {
                if (Number.isFinite(exercise.formScore)) currentWeek.scores.push(exercise.formScore);
            });
        } else if (date >= previousWeekStart) {
            previousWeek.calories += calories;
            previousWeek.reps += reps;
            previousWeek.minutes += duration;
        }
    });

    const percentageDelta = (current, previous) => previous > 0
        ? Number((((current - previous) / previous) * 100).toFixed(1))
        : 0;
    const formAccuracy = currentWeek.scores.length
        ? Math.round(currentWeek.scores.reduce((total, score) => total + score, 0) / currentWeek.scores.length)
        : 0;

    return successResponse(res, 200, {
        summary: {
            caloriesWeek: currentWeek.calories,
            totalRepsWeek: currentWeek.reps,
            formAccuracy,
            minutesTrained: currentWeek.minutes,
            deltas: {
                calories: percentageDelta(currentWeek.calories, previousWeek.calories),
                reps: percentageDelta(currentWeek.reps, previousWeek.reps),
                accuracy: 0,
                minutes: percentageDelta(currentWeek.minutes, previousWeek.minutes),
            },
        },
        weeklyReps,
        monthlyCalories,
        accuracyHistory: [],
    });
});

export {getDashboardStats, getProgressAnalytics};
