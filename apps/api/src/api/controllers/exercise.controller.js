import Exercise from '../../models/Exercise.model.js';
import Tutorial from '../../models/Tutorial.model.js';

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
    const updatedExercise=await Exercise.findByIdAndUpdate(
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

const deleteExercise=async(req,res)=>{
    try{
        const deletedExercise=await Exercise.findByIdAndDelete(req.params.id);

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

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tutorial = await Tutorial.findOne({
        title: { $regex: escapedName, $options: 'i' },
        videoUrl: { $exists: true, $ne: '' },
    }).sort({ order: 1 });

    if (tutorial) {
        return res.status(200).json({name:tutorial.title,videoUrl:tutorial.videoUrl,source:'tutorial',tutorialId:tutorial._id});
    }

    return res.status(404).json({message:'No example found for this exercise'});
 }catch(error){
    console.error('Get Exercise Example error',error.message);
    res.status(500).json({message:'Server Error'});
 }
}

const streamExerciseVideo = async (req, res) => {
  try {
    const rawUrl = req.query.url;
    const directId = req.query.id;
    let fileId = directId;
    if (!fileId && rawUrl) {
      const match = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      fileId = match ? match[1] : null;
    }

    if (!fileId) {
      return res.status(400).json({ message: 'Missing file id or url' });
    }

    const driveUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;
    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const driveRes = await fetch(driveUrl, { headers, redirect: 'follow' });

    res.status(driveRes.status);
    res.setHeader('Content-Type', driveRes.headers.get('content-type') || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (driveRes.headers.get('content-range')) {
      res.setHeader('Content-Range', driveRes.headers.get('content-range'));
    }
    if (driveRes.headers.get('content-length')) {
      res.setHeader('Content-Length', driveRes.headers.get('content-length'));
    }

    const { Readable } = await import('stream');
    const nodeStream = Readable.fromWeb(driveRes.body);
    nodeStream.pipe(res);
  } catch (error) {
    console.error('Stream exercise video error:', error.message);
    res.status(500).json({ message: 'Error streaming video' });
  }
};

export {
    getAllExercise,
    getExerciseById,
    updateExercise,
    createExercise,
    deleteExercise,
    getExerciseExample,
    streamExerciseVideo
};


 



