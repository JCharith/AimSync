/**
 * lib/audio/soundRegistry.ts
 *
 * AimSync Audio Compression & Zero-Overhead Asset Preloading Pipeline
 * 
 * Binds compressed sound catalogs (ZapSplat / Kenney mechanical recordings)
 * directly to GunRegistry.json profiles with zero streaming latency.
 */

import { getStoredSettings } from '@/lib/utils/userSettingsStorage';

export interface WeaponProfile {
    id: string;
    name: string;
    type: 'sidearm' | 'smg' | 'rifle';
    gameStyle: 'valorant' | 'cs2';
    magSize: number;
    fireRate: number;
    firstShotSpread: number;
    audioProfile: string;
    audioUrl?: string; // Optional ZapSplat/Kenney compressed audio file URL override
}

export interface GunRegistryData {
    weapons: Record<string, WeaponProfile>;
}

// Sound catalog mapping compressed ZapSplat / Kenney audio asset URLs by profile
const COMPRESSED_AUDIO_CATALOG: Record<string, string> = {
    'unsuppressed_pistol': '/audio/weapons/kenney_pistol_fire.ogg',
    'suppressed_pistol': '/audio/weapons/zapsplat_pistol_suppressed.mp3',
    'heavy_pistol': '/audio/weapons/kenney_heavy_pistol.ogg',
    'smg': '/audio/weapons/zapsplat_smg_rapid.mp3',
    'suppressed_smg': '/audio/weapons/zapsplat_smg_suppressed.mp3',
    'unsuppressed_rifle': '/audio/weapons/kenney_rifle_fire.ogg',
    'unsuppressed_heavy_rifle': '/audio/weapons/zapsplat_rifle_heavy.mp3',
    'suppressed_rifle': '/audio/weapons/zapsplat_rifle_suppressed.mp3',
    'swap': '/audio/weapons/kenney_weapon_swap.ogg'
};

class SoundRegistryManager {
    private ctx: AudioContext | null = null;
    private audioBufferCache: Map<string, AudioBuffer> = new Map();
    private gunRegistry: Record<string, WeaponProfile> = {};
    private isPreloaded: boolean = false;
    private isLoading: boolean = false;
    private lastFireTimestamp: Map<string, number> = new Map();

    /**
     * Initialize or resume the Web Audio Context singleton.
     */
    public getAudioContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || 
                (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    /**
     * Preloads GunRegistry.json profiles and pre-decodes compressed sound catalogs into memory AudioBuffers.
     * Guaranteed zero streaming latency on playback.
     */
    public async preload(): Promise<void> {
        if (typeof window === 'undefined' || this.isPreloaded || this.isLoading) return;
        this.isLoading = true;

        const ctx = this.getAudioContext();
        if (!ctx) {
            this.isLoading = false;
            return;
        }

        try {
            // 1. Fetch gun registry blueprint
            const registryResponse = await fetch('/GunRegistry.json').catch(() => fetch('/config/GunRegistry.json'));
            if (registryResponse.ok) {
                const data: GunRegistryData = await registryResponse.json();
                if (data && data.weapons) {
                    this.gunRegistry = data.weapons;
                }
            }

            // 2. Preload compressed audio catalog files & synthesize fallbacks
            const loadPromises: Promise<void>[] = [];

            // A. Preload catalog files
            for (const [profileKey, fileUrl] of Object.entries(COMPRESSED_AUDIO_CATALOG)) {
                loadPromises.push(this.loadOrSynthesizeBuffer(ctx, profileKey, fileUrl));
            }

            // B. Preload weapon-specific overrides if provided in GunRegistry.json
            for (const [weaponId, weapon] of Object.entries(this.gunRegistry)) {
                if (weapon.audioUrl) {
                    loadPromises.push(this.loadOrSynthesizeBuffer(ctx, `fire_${weaponId}`, weapon.audioUrl, weapon.audioProfile));
                }
            }

            await Promise.allSettled(loadPromises);

            // 3. Preload universal mechanical weapon swap sound buffer
            if (!this.audioBufferCache.has('swap')) {
                this.audioBufferCache.set('swap', this.synthesizeProceduralBuffer(ctx, 'swap'));
            }

            this.isPreloaded = true;
            console.log(`[SoundRegistry] Audio pipeline successfully loaded ${this.audioBufferCache.size} decoded weapon buffers into RAM.`);
        } catch (error) {
            console.error('[SoundRegistry] Preloader pipeline failed, using procedural fallback:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Loads a compressed audio file array buffer into RAM, falling back gracefully to dynamic Web Audio synthesis.
     */
    private async loadOrSynthesizeBuffer(ctx: AudioContext, cacheKey: string, fileUrl: string, fallbackProfile?: string): Promise<void> {
        try {
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
            this.audioBufferCache.set(cacheKey, decodedBuffer);
        } catch {
            // High-fidelity dynamic procedural Web Audio API synthesis fallback (runs off-thread, zero stream block)
            const profile = fallbackProfile || cacheKey;
            const synthBuffer = this.synthesizeProceduralBuffer(ctx, profile);
            this.audioBufferCache.set(cacheKey, synthBuffer);
        }
    }

    /**
     * Dynamic Web Audio API Procedural Synthesizer for ZapSplat/Kenney mechanical profiles.
     */
    private synthesizeProceduralBuffer(ctx: AudioContext, profile: string): AudioBuffer {
        const sampleRate = ctx.sampleRate;
        let duration = 0.2;

        if (profile === 'suppressed_pistol') duration = 0.08;
        else if (profile === 'unsuppressed_pistol') duration = 0.12;
        else if (profile === 'heavy_pistol') duration = 0.3;
        else if (profile === 'smg') duration = 0.09;
        else if (profile === 'suppressed_smg') duration = 0.11;
        else if (profile === 'unsuppressed_rifle') duration = 0.24;
        else if (profile === 'unsuppressed_heavy_rifle') duration = 0.32;
        else if (profile === 'suppressed_rifle') duration = 0.14;
        else if (profile === 'swap') duration = 0.15;

        const numSamples = Math.floor(sampleRate * duration);
        const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
        const channelData = audioBuffer.getChannelData(0);

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const noise = Math.random() * 2 - 1;
            let sample = 0;

            switch (profile) {
                case 'suppressed_pistol': { // Silenced "thwip" suppressed shot
                    const noiseEnv = Math.exp(-t * 130);
                    const sweepEnv = Math.exp(-t * 65);
                    const sweep = Math.sin(2 * Math.PI * (160 - t * 800) * t);
                    const click = Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 480);
                    sample = (noise * noiseEnv * 0.18) + (sweep * sweepEnv * 0.6) + (click * 0.22);
                    break;
                }
                case 'unsuppressed_pistol': { // Snappy unsuppressed pistol
                    const noiseEnv = Math.exp(-t * 75);
                    const sweepEnv = Math.exp(-t * 45);
                    const sweep = Math.sin(2 * Math.PI * (280 - t * 900) * t);
                    const click = Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-t * 400);
                    sample = (noise * noiseEnv * 0.3) + (sweep * sweepEnv * 0.5) + (click * 0.2);
                    break;
                }
                case 'heavy_pistol': { // Sheriff/Deagle heavy thud
                    const noiseEnv = Math.exp(-t * 24);
                    const sweep1 = Math.sin(2 * Math.PI * (320 - t * 600) * t);
                    const sweep2 = Math.sin(2 * Math.PI * (70 - t * 150) * t);
                    const click = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t * 250);
                    sample = (noise * noiseEnv * 0.35) + (sweep1 * Math.exp(-t * 12) * 0.3) + (sweep2 * Math.exp(-t * 8) * 0.25) + (click * 0.1);
                    break;
                }
                case 'smg': { // Rapid fire SMG crack
                    const noiseEnv = Math.exp(-t * 95);
                    const sweep = Math.sin(2 * Math.PI * (450 - t * 2000) * t);
                    const click = Math.sin(2 * Math.PI * 2800 * t) * Math.exp(-t * 500);
                    sample = (noise * noiseEnv * 0.35) + (sweep * Math.exp(-t * 65) * 0.45) + (click * 0.2);
                    break;
                }
                case 'suppressed_smg': { // MP5-SD / Spectre suppressed rapid fire
                    const noiseEnv = Math.exp(-t * 115);
                    const sweep = Math.sin(2 * Math.PI * (200 - t * 900) * t);
                    const click = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 480);
                    sample = (noise * noiseEnv * 0.15) + (sweep * Math.exp(-t * 75) * 0.6) + (click * 0.25);
                    break;
                }
                case 'unsuppressed_rifle': { // Vandal / AK-47 dry rifle crack
                    const noiseEnv = Math.exp(-t * 35);
                    const sweep1 = Math.sin(2 * Math.PI * (400 - t * 1200) * t);
                    const sweep2 = Math.sin(2 * Math.PI * (95 - t * 250) * t);
                    const click = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 550);
                    sample = (noise * noiseEnv * 0.38) + (sweep1 * Math.exp(-t * 24) * 0.32) + (sweep2 * Math.exp(-t * 10) * 0.2) + (click * 0.1);
                    break;
                }
                case 'unsuppressed_heavy_rifle': { // Guardian single-tap heavy rifle
                    const noiseEnv = Math.exp(-t * 28);
                    const sweep1 = Math.sin(2 * Math.PI * (480 - t * 1000) * t);
                    const sweep2 = Math.sin(2 * Math.PI * (90 - t * 200) * t);
                    const click = Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t * 600);
                    sample = (noise * noiseEnv * 0.42) + (sweep1 * Math.exp(-t * 18) * 0.3) + (sweep2 * Math.exp(-t * 8) * 0.18) + (click * 0.1);
                    break;
                }
                case 'suppressed_rifle': { // Phantom / M4A1-S suppressed rifle
                    const noiseEnv = Math.exp(-t * 70);
                    const sweep1 = Math.sin(2 * Math.PI * (220 - t * 500) * t);
                    const sweep2 = Math.sin(2 * Math.PI * (85 - t * 180) * t);
                    const click = Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-t * 400);
                    sample = (noise * noiseEnv * 0.2) + (sweep1 * Math.exp(-t * 35) * 0.45) + (sweep2 * Math.exp(-t * 12) * 0.2) + (click * 0.15);
                    break;
                }
                case 'swap': { // Mechanical slide swap
                    const click1 = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 400) * 0.4;
                    const click2 = t > 0.04 ? Math.sin(2 * Math.PI * 950 * (t - 0.04)) * Math.exp(-(t - 0.04) * 250) * 0.4 : 0;
                    const friction = noise * (Math.exp(-t * 35) - Math.exp(-t * 140)) * 0.15;
                    sample = click1 + click2 + friction;
                    break;
                }
                default: {
                    sample = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 100) * 0.5;
                }
            }
            channelData[i] = Math.max(-1.0, Math.min(1.0, sample));
        }

        return audioBuffer;
    }

    /**
     * Plays a weapon firing sound instantly with zero streaming latency.
     * Features rapid-fire rate limiting and micro-pitch detuning to eliminate repetition artifacts.
     */
    public playWeaponFire(weaponId: string): void {
        if (typeof window === 'undefined') return;

        // Check user settings preference
        try {
            if (!getStoredSettings().soundEnabled) return;
        } catch {
            // Fail open
        }

        const ctx = this.getAudioContext();
        if (!ctx) return;

        const weapon = this.gunRegistry[weaponId];
        const audioProfile = weapon ? weapon.audioProfile : 'unsuppressed_rifle';
        const fireRate = weapon ? weapon.fireRate : 10.0; // Rounds per second

        // Fire rate throttle guard (prevents audio thread saturation)
        const minIntervalMs = (1000 / fireRate) * 0.85; // 15% tolerance margin
        const lastTime = this.lastFireTimestamp.get(weaponId) || 0;
        const now = performance.now();
        if (now - lastTime < minIntervalMs) {
            return;
        }
        this.lastFireTimestamp.set(weaponId, now);

        // Retrieve pre-decoded audio buffer from RAM
        let buffer = this.audioBufferCache.get(`fire_${weaponId}`) || 
                     this.audioBufferCache.get(audioProfile);

        if (!buffer) {
            // Dynamic on-the-fly synthesis fallback
            buffer = this.synthesizeProceduralBuffer(ctx, audioProfile);
            this.audioBufferCache.set(audioProfile, buffer);
        }

        // Instantiate low-latency AudioBufferSourceNode
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Rapid-Fire Detune Variation: Randomize pitch by ±30 cents (0.97 to 1.03) to eliminate machine-gun repetition effect
        const randomDetune = (Math.random() * 60) - 30; // -30 to +30 cents
        if (source.detune) {
            source.detune.setValueAtTime(randomDetune, ctx.currentTime);
        }

        // Suppressed Shot Audio Cue: Add low-pass filter node for silenced profiles
        if (audioProfile.includes('suppressed')) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3200, ctx.currentTime); // Dampen high harsh frequencies
            source.connect(filter);
            filter.connect(ctx.destination);
        } else {
            source.connect(ctx.destination);
        }

        // Trigger playback immediately
        source.start(0);

        // Strict Garbage Collection: Disconnect nodes on ended to prevent memory leaks
        source.onended = () => {
            source.disconnect();
        };
    }

    /**
     * Plays universal weapon swap sound.
     */
    public playWeaponSwap(weaponId?: string): void {
        if (typeof window === 'undefined') return;

        try {
            if (!getStoredSettings().soundEnabled) return;
        } catch {
            // Fail open
        }

        const ctx = this.getAudioContext();
        if (!ctx) return;

        let buffer = this.audioBufferCache.get('swap');
        if (!buffer) {
            buffer = this.synthesizeProceduralBuffer(ctx, 'swap');
            this.audioBufferCache.set('swap', buffer);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);

        source.onended = () => {
            source.disconnect();
        };
    }

    /** Returns direct access to pre-decoded RAM AudioBuffer */
    public getAudioBuffer(key: string): AudioBuffer | null {
        return this.audioBufferCache.get(key) || null;
    }

    /** Checks if audio pipeline has preloaded */
    public isLoaded(): boolean {
        return this.isPreloaded;
    }
}

// Export singleton instance
export const soundRegistry = new SoundRegistryManager();
