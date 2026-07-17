import User from "../../models/User.model.js";
const getUserProfile=async(req,res)=>{
    

    try{
        const user=req.user;
        if(user){
            res.status(200).json({
                _id:user._id,
                name:user.name,
                email:user.email,
                age:user.age,
                height:user.height,
                weight:user.weight,
                fitnessGoals:user.fitnessGoals
            })
        }
        else{
            res.status(404).json({
                message:'User not found'
            })
        }
    }
    catch(error){
        console.error('Get Profile Error:',error);
        res.status(500).json({
            message:'Server Error'
        })
    }
}

const updateUserProfile=async(req,res)=>{
    try{
        const user=await User.findById(req.user._id);

        if(user){
            user.name=req.body.name || user.name;
            user.age=req.body.age || user.age;
            user.height=req.body.height || user.height;
            user.weight=req.body.weight || user.weight;
            user.fitnessGoals=req.body.fitnessGoals || user.fitnessGoals;

            const updatedUser=await user.save();

            res.status(200).json({
                _id:updatedUser._id,
                name:updatedUser.name,
                email:updatedUser.email,
                age:updatedUser.age,
                weight: updatedUser.weight,
                height: updatedUser.height,
                fitnessGoals: updatedUser.fitnessGoals,
            })
        }
        else{
            res.status(404).json({
                message:'User not found'
            })
        }
    }
        catch(error){
            console.error('Update profile Erorr',error.message);
            res.status(500).json({
                message:'Server Error'
            })
        }
    }

    export {getUserProfile,updateUserProfile};