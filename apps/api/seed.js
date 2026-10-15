import mongoose from "mongoose";
import dotenv from "dotenv";
import Exercise from "./src/models/Exercise.model.js";
import Tutorial from "./src/models/Tutorial.model.js";
import User from "./src/models/User.model.js";

dotenv.config();

const connectDB=async()=>{
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected for the Seeding...')
    }catch(err){
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

const exercises = [
    {
        name: 'Squat',
        description: 'A fundamental lower-body exercise that strengthens the quadriceps, glutes, and hamstrings.',
        difficulty: 'Beginner',
        musclesTargeted: ['Quadriceps', 'Glutes', 'Hamstrings', 'Calves'],
        videoUrl: 'https://drive.google.com/file/d/15DMKdbGRG7JAolMVt7wDModOQFlbVhwc/preview',
    },
    {
        name: 'Push-up',
        description: 'A classic bodyweight exercise that builds upper-body strength in the chest, shoulders, and triceps.',
        difficulty: 'Intermediate',
        musclesTargeted: ['Pectorals', 'Deltoids', 'Triceps', 'Core'],
        videoUrl: 'https://drive.google.com/file/d/1ZXfyZGiZOT5KSDWv2CbGnRV7N-RGliiH/preview',
    },
    {
        name: 'Lunge',
        description: 'An effective single-leg exercise that improves balance, stability, and strength in the legs and glutes.',
        difficulty: 'Beginner',
        musclesTargeted: ['Quadriceps', 'Glutes', 'Hamstrings'],
        videoUrl: 'https://drive.google.com/file/d/1sQHZg8yI4jBqFIp4jXccJwy2FRmf6AsL/preview',
    },
    {
        name: 'Bicep Curl',
        description: 'An isolation exercise that targets the biceps by flexing the elbow to lift a weight towards the shoulder.',
        difficulty: 'Beginner',
        musclesTargeted: ['Biceps', 'Brachialis'],
        videoUrl: 'https://drive.google.com/file/d/1drrHhKq5EaZKIwNxQiQlolocpZ0dR-my/preview',
    },
    {
        name: 'Shoulder Press',
        description: 'An upper-body strength exercise that involves pressing a weight overhead to develop the deltoid muscles.',
        difficulty: 'Intermediate',
        musclesTargeted: ['Deltoids', 'Triceps', 'Trapezius'],
        videoUrl: 'https://example.com/videos/shoulderpress.mp4',
    },
    {
        name: 'Jumping Jack',
        description: 'A full-body cardiovascular exercise that involves jumping to a position with legs spread wide and hands touching overhead.',
        difficulty: 'Beginner',
        musclesTargeted: ['Full Body', 'Cardio'],
        videoUrl: 'https://drive.google.com/file/d/1h433n694MlPYQNcSYbSS_9Dzjy5D5trn/preview',
    },
    {
        name: 'Tricep Dip',
        description: 'A bodyweight exercise that targets the triceps by lowering and raising the body using a bench or chair.',
        difficulty: 'Intermediate',
        musclesTargeted: ['Triceps', 'Pectorals', 'Deltoids'],
        videoUrl: 'https://example.com/videos/tricepdip.mp4',
    },
    {
        name: 'Mountain Climber',
        description: 'A dynamic, full-body exercise that mimics the motion of climbing, building core strength and endurance.',
        difficulty: 'Intermediate',
        musclesTargeted: ['Core', 'Deltoids', 'Glutes', 'Cardio'],
        videoUrl: 'https://example.com/videos/mountainclimber.mp4',
    },
];

// 2. ADD TUTORIAL DATA
const tutorials = [
    {
        title: "How to Do a Perfect Squat",
        description: "Learn the fundamentals of the bodyweight squat for strength and mobility.",
        videoUrl: "https://www.youtube.com/watch?v=ultWZbEVQP4",
        steps: [
            "Stand with your feet shoulder-width apart.",
            "Keep your chest up and your back straight.",
            "Lower your hips as if sitting in a chair.",
            "Go as low as you can comfortably, aiming for thighs parallel to the ground.",
            "Push through your heels to return to the starting position."
        ],
        order: 1,
    },
    {
        title: "Mastering the Push-Up",
        description: "A complete guide to the push-up, a foundational upper-body exercise.",
        videoUrl: "https://www.youtube.com/watch?v=IODxDxX7oi4",
        steps: [
            "Start in a high plank position with hands under your shoulders.",
            "Keep your body in a straight line from head to heels.",
            "Lower your body until your chest nearly touches the floor.",
            "Push back up to the starting position, keeping your core engaged."
        ],
        order: 2,
    }
];

const importData=async()=>{
    try{
        await Exercise.deleteMany();
        await Tutorial.deleteMany();
        await User.deleteMany();

        await Exercise.insertMany(exercises);
        await Tutorial.insertMany(tutorials);

          await User.create({
            name: 'adminvinayak',
            email: 'adminvinayak@example.com',
            password: 'adminpassword123',
            role: 'admin'
        });

        console.log('Data Imported! (Exercises & Tutorials)');
        process.exit();
    }catch(error){
         console.error(`Error: ${error}`);
        process.exit(1);
    }
}

const destroyData=async()=>{
    try{
        await Exercise.deleteMany();
        await Tutorial.deleteMany();
        await User.deleteMany();

        console.log('Data Destroyed! (Exercises & Tutorials)');
        process.exit();
    }
    catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
    }
}

const runSeeder = async () => {
    await connectDB();
    if (process.argv[2] === '-d') {
        await destroyData();
    } else {
        await importData();
    }
    mongoose.connection.close();
};

runSeeder();