import { calculateAngle } from "./utils.js";

class MountainClimberProcessor {
  constructor() {
    this.stage = 'start'; // 'start', 'left_up', 'right_up'
    this.repCount = 0;
    this.feedback = 'Get into a plank position with both knees back.';
    this.formScore = 0;
  }

  /**
   * @function process
   * @description Processes a single frame of pose data to analyze mountain climbers.
   * @param {object} poseLandmarks - An array of 33 pose landmarks.
   * @returns {object} An object containing the current rep count and feedback.
   */
  process(poseLandmarks) {
    if (!poseLandmarks || poseLandmarks.length < 33) {
      this.feedback = 'Pose data not found.';
      return { repCount: this.repCount, feedback: this.feedback };
    }

    // --- 1. Get Keypoints ---
    const leftShoulder = poseLandmarks[11];
    const leftHip = poseLandmarks[23];
    const leftKnee = poseLandmarks[25];
    const leftAnkle = poseLandmarks[27];

    const rightShoulder = poseLandmarks[12];
    const rightHip = poseLandmarks[24];
    const rightKnee = poseLandmarks[26];
    const rightAnkle = poseLandmarks[28];
    
    // --- 2. Form Validation: Maintain Plank ---
    const leftBodyAngle = calculateAngle(leftShoulder, leftHip, leftAnkle);
    const rightBodyAngle = calculateAngle(rightShoulder, rightHip, rightAnkle);

    // Check if body is in proper plank position (should be close to 180 degrees)
    const isLeftBodyStraight = leftBodyAngle > 150;
    const isRightBodyStraight = rightBodyAngle > 150;

    if (!isLeftBodyStraight || !isRightBodyStraight) {
        this.feedback = 'Keep your back straight and maintain a proper plank!';
        return { repCount: this.repCount, feedback: this.feedback };
    }

    // --- 3. Repetition Counting Logic ---
    // Stage-based mountain climber detection (like pushups)
    // Uses distance to opposite shoulder with hysteresis

    const leftKneeToRightShoulderDist = Math.sqrt(
      Math.pow(leftKnee.x - rightShoulder.x, 2) + Math.pow(leftKnee.y - rightShoulder.y, 2)
    );
    const rightKneeToLeftShoulderDist = Math.sqrt(
      Math.pow(rightKnee.x - leftShoulder.x, 2) + Math.pow(rightKnee.y - leftShoulder.y, 2)
    );

    // Normalize by body size (distance between shoulders)
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x) || 1; // Prevent division by zero
    const closeThreshold = shoulderWidth * 0.6; // Close enough to count as forward
    const farThreshold = shoulderWidth * 0.9; // Far enough to count as back

    const leftKneeClose = leftKneeToRightShoulderDist < closeThreshold;
    const leftKneeFar = leftKneeToRightShoulderDist > farThreshold;
    const rightKneeClose = rightKneeToLeftShoulderDist < closeThreshold;
    const rightKneeFar = rightKneeToLeftShoulderDist > farThreshold;

    // Simple alternating detection like jumping jacks
    // Define clear positions
    const bothKneesBack = leftKneeFar && rightKneeFar;
    const leftKneeForwardOnly = leftKneeClose && rightKneeFar;
    const rightKneeForwardOnly = rightKneeClose && leftKneeFar;

    // Stage transitions
    if (this.stage === 'start') {
      if (leftKneeForwardOnly) {
        this.stage = 'left_up';
        this.repCount += 1;
        this.feedback = 'Good! Left knee forward.';
      } else if (rightKneeForwardOnly) {
        this.stage = 'right_up';
        this.repCount += 1;
        this.feedback = 'Good! Right knee forward.';
      }
    } else if (this.stage === 'left_up') {
      if (bothKneesBack) {
        this.stage = 'start';
        this.feedback = 'Both knees back. Ready for next rep.';
      }
    } else if (this.stage === 'right_up') {
      if (bothKneesBack) {
        this.stage = 'start';
        this.feedback = 'Both knees back. Ready for next rep.';
      }
    }
    // --- 4. Score: plank straightness + knee drive
    const plankErr = Math.min(1, ((Math.abs(180 - leftBodyAngle) + Math.abs(180 - rightBodyAngle)) / 2) / 40);
    // Knee drive: higher score when knee is closer to hip (more forward)
    const leftLegRange = Math.max(0.001, Math.abs(leftAnkle.y - leftHip.y));
    const rightLegRange = Math.max(0.001, Math.abs(rightAnkle.y - rightHip.y));
    const leftDrive = Math.min(1, Math.max(0, 1 - Math.abs(leftKnee.y - leftHip.y) / leftLegRange));
    const rightDrive = Math.min(1, Math.max(0, 1 - Math.abs(rightKnee.y - rightHip.y) / rightLegRange));
    // Note: with camera facing user, y increases downward; forward knee has lower y (closer to chest).
    const driveScore = (leftDrive + rightDrive) / 2;
    const inst = 100 * (1 - 0.5 * plankErr) * (0.5 + 0.5 * driveScore); // keep some score even when not driving
    this.formScore = Math.round(0.8 * this.formScore + 0.2 * Math.max(0, Math.min(100, inst)));

    return {
      repCount: this.repCount,
      feedback: this.feedback,
      score: this.formScore,
    };
  }
}

export default MountainClimberProcessor;