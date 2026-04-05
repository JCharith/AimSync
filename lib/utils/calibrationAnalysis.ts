// lib/utils/calibrationAnalysis.ts
export interface ClickData {
    targetX: number;
    targetY: number;
    clickX: number;
    clickY: number;
}
import { CalibrationTrial, CalibrationResult, RankedCalibrationTrial } from '../game/calibration';

// Calculates consistency (Lower Standard Deviation = Better Consistency)
export const calculateConsistencyScore = (reactionTimes: number[]): number => {
    if (reactionTimes.length < 2) return 0;

    const mean = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
    const variance = reactionTimes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / reactionTimes.length;
    const standardDeviation = Math.sqrt(variance);

    // Normalizing standard deviation into a 0-100 score. 
    // Assuming >150ms variance is terrible (0), and <15ms is pro-tier (100).
    let score = 100 - ((standardDeviation - 15) / (150 - 15)) * 100;
    return Math.max(0, Math.min(100, Math.round(score)));
};

// Analyzes the physical coordinates to detect aim bias
export const analyzeAimTendency = (clicks: ClickData[]) => {
    let overshootCount = 0;
    let undershootCount = 0;

    clicks.forEach(click => {
        // Distance from center of screen (start position) to the target
        const targetDist = Math.hypot(click.targetX, click.targetY);
        // Distance from center of screen to where they actually clicked
        const clickDist = Math.hypot(click.clickX, click.clickY);

        // 15px buffer for standard error
        if (clickDist > targetDist + 15) overshootCount++;
        else if (clickDist < targetDist - 15) undershootCount++;
    });

    const totalErrors = overshootCount + undershootCount;
    if (totalErrors === 0) return "Perfect Calibration";

    const overRatio = overshootCount / totalErrors;

    if (overRatio > 0.65) return "Significant Overshoot (Lower Sensitivity)";
    if (overRatio < 0.35) return "Significant Undershoot (Raise Sensitivity)";
    return "Balanced Error (Focus on Motor Control)";
};

// Builds a set of sensitivity candidates around a baseline
export const buildSensitivityCandidates = (baseSensitivity: number): CalibrationTrial[] => {
    // Generate variations: -30%, -15%, Baseline, +15%, +30%
    const multipliers = [0.7, 0.85, 1.0, 1.15, 1.3];
    return multipliers.map(m => ({
        sensitivity: baseSensitivity * m,
        accuracy: 0,
        comfort: 0,
        speed: 0,
        overflickRate: 0,
        underflickRate: 0,
    }));
};

// Analyzes the calibration trials and determines the recommended sensitivity
export const analyzeCalibrationTrials = (trials: CalibrationTrial[]): CalibrationResult => {
    const rankedTrials: RankedCalibrationTrial[] = trials.map(trial => {
        // Calculate a composite score based on metrics (assuming inputs are 0-100)
        // Adjust weightings as necessary
        const score = (trial.accuracy * 1.5) 
                    + (trial.comfort * 1.0) 
                    + (trial.speed * 1.2) 
                    - (trial.overflickRate * 1.0) 
                    - (trial.underflickRate * 1.0);
        
        return {
            ...trial,
            compositeScore: score
        };
    }).sort((a, b) => b.compositeScore - a.compositeScore); // Higher is better

    const recommendedSensitivity = rankedTrials.length > 0 ? rankedTrials[0].sensitivity : 0.35;

    return {
        recommendedSensitivity,
        rankedTrials
    };
};