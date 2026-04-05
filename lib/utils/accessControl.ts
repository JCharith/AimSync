// lib/utils/accessControl.ts

// Define the modes that a guest can play without an account
export const FREE_TIER_MODES = [
    "static-flick",
    "tracking-mode",
    "reaction-test"
];

/**
 * Evaluates if the current user state has permission to play the requested mode.
 */
export const canAccessMode = (modeId: string, isLoggedIn: boolean): boolean => {
    // 1. Logged in users get everything
    if (isLoggedIn) return true;

    // 2. Guests only get the free tier
    return FREE_TIER_MODES.includes(modeId);
};