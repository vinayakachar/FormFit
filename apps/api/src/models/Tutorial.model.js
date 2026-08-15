import mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const tutorialSchema=new Schema({
    title:{
        type:String,
        required:[true,'Tutorial title is required']
    }, description: {
        type: String,
        required: [true, 'Tutorial description is required.'],
    },
    videoUrl: {
        type: String,
    },
    steps: {
        type: [String],
        default: [],
    },
    order: {
        type: Number,
        required: true,
        default: 0,
        index: true, 
    },
}, {
    timestamps: true, 
});

tutorialSchema.plugin(mongoosePaginate);

const Tutorial=mongoose.model('Tutorial',tutorialSchema);

export default Tutorial;
