import { calculateAngle } from "./utils.js";

class BicepCurlProcessor{
     constructor() {
    this.stage = 'down'; 
    this.repCount = 0;
    this.feedback = 'Start with your arms extended.';
    this.initialShoulderY = null; 
    this.formScore = 0; 
  }

   process(poseLandmarks) {
    if (!poseLandmarks || poseLandmarks.length < 33) {
      this.feedback = 'Pose data not found.';
      return { repCount: this.repCount, feedback: this.feedback };
    }

    const leftShoulder = poseLandmarks[11];
    const leftElbow = poseLandmarks[13];
    const leftWrist = poseLandmarks[15];

    const rightShoulder = poseLandmarks[12];
    const rightElbow = poseLandmarks[14];
    const rightWrist = poseLandmarks[16];

    const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);

    const isUpPosition = leftElbowAngle < 50 && rightElbowAngle < 50;
    const isDownPosition = leftElbowAngle > 160 && rightElbowAngle > 160;

    if (this.stage === 'down' && isDownPosition) {
        this.initialShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    }

    if (this.initialShoulderY && this.stage === 'up') {
        const currentShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        if (Math.abs(currentShoulderY - this.initialShoulderY) > 0.05) { // Threshold for vertical movement
            this.feedback = 'Avoid swinging your body. Keep your torso stable.';
            // Don't count the rep if form is bad
            return { repCount: this.repCount, feedback: this.feedback, stage: this.stage };
        }
    }

     if (isUpPosition && this.stage === 'down') {
      this.stage = 'up';
      this.feedback = 'Now lower with control.';
    } else if (isDownPosition && this.stage === 'up') {
      this.stage = 'down';
      this.repCount += 1;
      this.feedback = 'Excellent curl!';
      this.initialShoulderY = null; // Reset for the next rep
    }

     if (this.stage === 'down' && leftElbowAngle < 150) { // On the way up
        if (leftElbowAngle < 70) {
            this.feedback = 'Squeeze at the top.';
        } else {
            this.feedback = 'Curl higher.';
        }
    }

    const targetUp = 40, targetDown = 170;
    const target = this.stage === 'up' ? targetUp : targetDown;
    const errL = Math.min(1, Math.abs((this.stage === 'up' ? leftElbowAngle - targetUp : leftElbowAngle - targetDown)) / (this.stage === 'up' ? 60 : 30));
    const errR = Math.min(1, Math.abs((this.stage === 'up' ? rightElbowAngle - targetUp : rightElbowAngle - targetDown)) / (this.stage === 'up' ? 60 : 30));
    let inst = 100 * (1 - (errL + errR) / 2);
    if (this.initialShoulderY && this.stage === 'up') {
      const currentShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      if (Math.abs(currentShoulderY - this.initialShoulderY) > 0.05) inst *= 0.7; // penalize swing
    }

     this.formScore = Math.round(0.8 * this.formScore + 0.2 * Math.max(0, Math.min(100, inst)));

    return {
      repCount: this.repCount,
      feedback: this.feedback,
      stage: this.stage,
      score: this.formScore,
    };
}
}

export default BicepCurlProcessor;
