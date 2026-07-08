import mongoose,{Schema} from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { timeStamp } from "console";

const userSchema=new Schema({
    name:{
        type:String,
        required:[true,"Please provide your name"],
        trim:true
    },
    email:{
        type:String,
        required:[true,"Please provide your email"],
        unique:true,
        match:[ /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,'Please provide a valid email address']
    },
    password:{
        type:String,
        required:[true,"Please provide a password"],
        minlength:6,
        select:false
    },
    age:Number,
    role:{
        type:String,
        enum:['user','admin'],
        default:'user'
    },
    weight:Number,
    height:Number,
    fitnessGoals:{
        type:[String],
        default:[]
    },
    passwordResetToken:String,
    passwordResetExpires:Date
},{timeStamp:true})

userSchema.pre('save',async function(next){
    if(!this.isModified('password')){
        return next();
    }
    const salt=await bcrypt.genSalt(10);
    this.password=await bcrypt.hash(this.password,salt);
    next();
});

userSchema.methods.createPasswordResetToken=function(){
    const resetToken=crypto.randomBytes(32).toString('hex');

    this.passwordResetToken=crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

    this.passwordResetExpires=Date.now()+10*60*1000;
    return resetToken;
};

const User=mongoose.model('User',userSchema);
export default User;