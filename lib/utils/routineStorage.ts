import { TrainingRoutine } from "../game/routine";

const ROUTINES_STORAGE_KEY = "aimforge_routines";

function safeParse(value: string | null): TrainingRoutine[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Failed to parse routines from localStorage:", error);
        return [];
    }
}

export function getStoredRoutines(): TrainingRoutine[] {
    if (typeof window === "undefined") return []; // SSR Safety Check
    return safeParse(localStorage.getItem(ROUTINES_STORAGE_KEY));
}

export function saveStoredRoutines(routines: TrainingRoutine[]): void {
    if (typeof window === "undefined") return; // SSR Safety Check
    localStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(routines));
}

export function createRoutine(
    routine: Omit<TrainingRoutine, "id" | "createdAt" | "updatedAt">
): TrainingRoutine {
    const now = new Date().toISOString();
    const newRoutine: TrainingRoutine = {
        ...routine,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
    };

    const existing = getStoredRoutines();
    saveStoredRoutines([newRoutine, ...existing]);
    return newRoutine;
}

export function updateRoutine(updatedRoutine: TrainingRoutine): TrainingRoutine {
    const existing = getStoredRoutines();
    const next = existing.map((routine) =>
        routine.id === updatedRoutine.id
            ? { ...updatedRoutine, updatedAt: new Date().toISOString() }
            : routine
    );

    saveStoredRoutines(next);
    return { ...updatedRoutine, updatedAt: new Date().toISOString() };
}

export function deleteRoutine(routineId: string): void {
    const existing = getStoredRoutines();
    const filtered = existing.filter((routine) => routine.id !== routineId);
    saveStoredRoutines(filtered);
}

export function getRoutineById(routineId: string): TrainingRoutine | null {
    const routines = getStoredRoutines();
    return routines.find((routine) => routine.id === routineId) ?? null;
}