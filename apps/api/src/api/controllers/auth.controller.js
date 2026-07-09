import User from "../../models/User.model";
import jwt from "jsonwebtoken";

const generateToken=(id)=>{
    return jwt.sign({id},process.env.JWT_SECRET,{
        expiresIn:'30d'
    });
}

const registerUser=asyncHandler(async(req,res)=>{
    const {name,email,password}=req.body;

    const userExists=await User.findOne({email});

    if(userExists){
        return errorResponse(res,400,"User with this email already exists");
    }

    const user=await User.create({  
        name,
        email,
        password
    });

    if(user){
        return successResponse(res,201,{
            _id:user._id,
            name:user.name,
            email:user.email,
            token:generateToken(user._id)
        });
    }
    else{
        return errorResponse(res,400,"Invalid user data");
    }
});

const loginUser=asyncHandler(async(req,res)=>{
    const {email,password}=req.body;
    
    const user=await User.findOne({email}).select("+password");

    if(user && (await bycrypt.compare(passowrd,user.password))){
        return successResponse(res,200,{
            _id:user._id,
            name:user.name,
            email:user.email,
            token:generateToken(user._id)
        });
    }
    else{
        return errorResponse(res,401,"Invalid email or password");
    }
}); 


const logoutUser=asyncHandler(async(req,res)=>{
    return successResponse(res,200,{message:"User logged out successfully"});
});

const forgotPassword=asyncHandler(async(req,res)=>{
    const {email}=req.body;

    if(!email){
        return errorResponse(res,400,"Please provide an email");
    }

    const user =await User.findOne({email});

    if(!user){
        return successResponse(res,200,{message:"If a user with that email exists, a token has been generated"});
    }

    const resetToken=ueser.createPasswordResetToken();
    await user.save({validateBeforeSave:false});

    successResponse(res,200,{message:"Token generated successfully.Use this token to reset your password",
        resetToken:resetToken});
 });

 const resetPassword=asyncHandler(async(req,res)=>{
    const hashedToken=crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

    const user=await User.findOne({
        passwordResetToken:hashedToken,
        passwordResetExpires:{$gt:Date.now()}       
    });

    if(!user){
        return errorResponse(res,400,"Token is invalid or has expired");
    }

     if (!req.body.password || req.body.password.length < 6) {
        return errorResponse(res, 400, 'Please provide a new password with at least 6 characters');
    }

    user.password=req.body.passowrd;
    user.passwordResetToken=undefined;
    user.passwordResetExpires=undefined;
    await user.save();

     const token = generateToken(user._id);
    successResponse(res, 200, {
        message: 'Password reset successful.',
        token,
    });
});

export {registerUser,loginUser,logoutUser,forgotPassword,resetPassword};
