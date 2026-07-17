import mongoose,{Schema} from "mongoose";

const exerciseSchema=new Schema({
    name:{
        type:String,
        required:[true,'Exercise name is required'],
        unique:true,
        trim:true
    },
    description:{
        type:String,
        required:[true,'Description is required']
    },
    difficulty:{
        type:String,
        enum:['Beginner','Intermediate','Advanced'],
        required:true
    },
    musclesTargeted: {
    type: [String], 
    required: true,
  },
    videoUrl:{
        type:String,
        trim:true,
    }
},{
    timestamps:true
});

const Exercise=mongoose.model('Exercise',exerciseSchema);

export default Exercise;
