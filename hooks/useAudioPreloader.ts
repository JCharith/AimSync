'use client';

import { useState, useEffect, useCallback } from 'react';
import { soundRegistry } from '@/lib/audio/soundRegistry';

export interface UseAudioPreloaderResult {
    isLoaded: boolean;
    isLoading: boolean;
    error: string | null;
    preloadAudio: () => Promise<void>;
    playWeaponSound: (weaponId: string) => void;
    playSwapSound: () => void;
}

/**
 * Ultra-lightweight Web Audio API audio preloader hook (useAudioPreloader.ts).
 * Loads, decodes, and buffers weapon sound assets into RAM AudioBuffers on engine initialization,
 * completely eliminating network streaming delays during rapid-fire drills.
 */
export function useAudioPreloader(): UseAudioPreloaderResult {
    const [isLoaded, setIsLoaded] = useState<boolean>(soundRegistry.isLoaded());
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const preloadAudio = useCallback(async () => {
        if (soundRegistry.isLoaded()) {
            setIsLoaded(true);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await soundRegistry.preload();
            setIsLoaded(true);
        } catch (err) {
            console.error('[useAudioPreloader] Preload error:', err);
            setError('Failed to preload audio assets');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        preloadAudio();
    }, [preloadAudio]);

    const playWeaponSound = useCallback((weaponId: string) => {
        soundRegistry.playWeaponFire(weaponId);
    }, []);

    const playSwapSound = useCallback(() => {
        soundRegistry.playWeaponSwap();
    }, []);

    return {
        isLoaded,
        isLoading,
        error,
        preloadAudio,
        playWeaponSound,
        playSwapSound,
    };
}
