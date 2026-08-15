import Exercise from '../models/Exercise.model.js';
import Tutorial from '../models/Tutorial.model.js';

const getAllExercise=async(req,res)=>{
    try{
        const page=parseInt(req.query.page,10) || 1;
        const limit=parseInt(req.query.limit,10) || 10;

        const skip=(page-1)*limit;

        const exercises=await Exercise.find({}).skip(skip).limit(limit);
        const totalExercises=await Exercise.countDocuments();

        res.status(200).json({
            total:totalExercises,
            page,
            pages:Math.ceil(totalExercises/limit),
            data:exercises
        });
    }catch(error){
        console.error('Get All Exercise Error',error.message);
        res.status(500).json({message:'Server Error'});
    };
}

const getExerciseById=async(req,res)=>{
    try{
        const exercise=await Exercise.findById(req.params.id);

        if(!exercise){
            return res.status(404).json({
                message:'Exercise not Found'
            })
        }
        res.status(200).json(exercise);
    }catch(error){
        console.error('Get Exercise By id error',error.message);
        if(error.name === 'CastError'){
            return res.status(400).json({
                message:'Invalid Exerxise'
            })
        }
        res.status(500).json({
            message:'Server Error'
        });
    }
}

const createExercise=async(req,res)=>{
    try{
        const {name,description,difficulty,musclesTargeted,videoUrl}=req.body;

        const newExercise=new Exercise({
            name,
            description,
            difficulty,
            musclesTargeted,
            videoUrl
        });

        const savedExercise=await newExercise.save();
        res.status(201).json(savedExercise);
    }catch(error){
        console.error('Create Exercise Errror');
        if(error.code === 11000){
            return res.status(400).json({
                message:'An exercise with this name already exist'
            })
        }
        res.status(500).json({
            message:'Server Error'
        });
    }
}

const updateExercise=async(req,res)=>{
    try{
    const updatedExercise=await findByIdandUpdate(
        req.params.id,
        req.body,{new:true,runValidators:true}
    );

    if(!updatedExercise){
        return res.status(404).json({message:'Exercise not found'})
    }

    res.status(200).json(updatedExercise);
    }catch(error){
        console.error('Update Exercise error',error.message);
    if(error.name === 'CastError'){
        return res.status(400).json({message:'Invalid Exercise Id'})
    }

    res.status(500).json({message:'Server Error'});
    }
}

const deleteExercise=(req,res)=>{
    try{
        const deletedExercise=await findByIdandUpdate(req.params.id);

        if(!deletedExercise){
            return res.status(404).json({message:'Exercise not found'})
        }

        res.status(200).json({message:'Exercise Deleted successfully'});
    }catch(error){
        console.error('Delete Exercise Error',error.message);
        if(error.name === 'CastError'){
            return res.status(400).json({message:'Invalis Exercise Id'})
        }
        res.status(500).json({message:'Server Error'})
    }
}


export {getAllExercise,
    getExerciseById,
    updateExercise,
    createExercise,
    deleteExercise,
    getExerciseExample
};

const getExerciseExample=async(req,res)=>{
 try{
    const name=(req.query.name || '').trim()
    if(!name)return res.status(400).json({message:'Missing name query param'});

    const ex=await Exercise.findOne({name});

    if(ex && ex.videoUrl){
        return res.status(200).json({name:ex.name,videoUrl:ex.videoUrl,source:'exercise',exerciseId:ex._id});
    }

    if(!ex){
        const ex2=await Exercise.findOne({name: {$regex : new RegExp(`^${name}$`,`i`)}});
        if(ex2 && ex2.videoUrl){
            return res.status(200).json({name:ex2.name,videoUrl:ex2.videoUrl,source:'exercise',exerciseId:ex2._id})
        }
    }

    const tut=await Tutorial.findOne({title:name}.sort({order:`asc`}));

    if(tut && tut.videoUrl){
        return res.status(200).json({name:tut.title,videoUrl:tut.videoUrl,source:'tutorial',tutorialId:tut._id});
    }

    const tut2=await Tutorial.findOne({titel:{$regex:new RegExp(name,'i')}});
    if(tut2 && tut2.videoUrl){
        return res.status(200).json({name:tut2.title,videoUrl:tut2.videoUrl,source:'tutorial',tutorialId:tut2._id})
    }
 }catch(error){
    console.error('Get Exercise Example error',error.message);
    res.status(500).json({message:'Server Error'});
 }
}
 



