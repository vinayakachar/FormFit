import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', required: true, index: true
 },
  provider: { type: String, 
    default: 'google' 
},
  model: { type: String,
     default: 'gemini-1.5-flash'
     },
  promptVersion: { type: String, 
    default: 'v1' 
},
  planObject: {
     type: Object
     },
  planText: { 
    type: String 
},
}, { timestamps: true });

const Plan=mongoose.model('Plan',planSchema);

export default Plan;