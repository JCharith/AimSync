'use client';

import { useThree } from '@react-three/fiber';
import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';

interface TargetProps {
    id: number;
    position: [number, number, number];
    onHit: (id: number) => void;
    scale: number;
    isFriendly: boolean;
    activeMode: string;
    spawnTime: number;
}

// ULTRA-LIGHTWEIGHT SPATIAL AUDIO CUE (Protocol 1: Echolocation)
function PositionalSound({ position }: { position: [number, number, number] }) {
    const audioRef = useRef<THREE.PositionalAudio>(null);
    const { camera } = useThree();

    useEffect(() => {
        const sound = audioRef.current;
        if (!sound) return;

        let listener = camera.children.find((c) => c instanceof THREE.AudioListener) as THREE.AudioListener;
        if (!listener) {
            listener = new THREE.AudioListener();
            camera.add(listener);
        }

        const ctx = THREE.AudioContext.getContext() as any;
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }

        // Generate synthetic sharp audio pulse on the fly for 360 spatial cues
        const rate = ctx.sampleRate || 44100;
        const duration = 0.18; // 180ms pulse
        const buffer = ctx.createBuffer(1, rate * duration, rate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const t = i / rate;
            // High-density transient attack sweep + exponential decay
            data[i] = Math.sin(2 * Math.PI * 950 * Math.exp(-18 * t) * t) * Math.exp(-22 * t);
        }

        sound.setBuffer(buffer);
        sound.setRefDistance(3);
        sound.setMaxDistance(40);
        sound.play();

        return () => {
            if (sound.isPlaying) sound.stop();
        };
    }, [camera, position]);

    const listener = camera.children.find((c) => c instanceof THREE.AudioListener) as THREE.AudioListener;
    if (!listener) return null;

    return <positionalAudio ref={audioRef} args={[listener]} position={position} />;
}

// Target Component
function Target({ id, position, onHit, scale, isFriendly, activeMode, spawnTime }: TargetProps) {
    // Protocol 2: Target Discrimination Color Signatures
    // Hostile (Red), Friendly/Distractor (Blue), Echolocation (Gold)
    const getTargetColor = () => {
        if (activeMode === 'cognitive-overdrive') {
            return isFriendly ? '#3366FF' : '#FF3333';
        }
        if (activeMode === 'echolocation') {
            return '#FFD700'; // Gold
        }
        return '#3366FF';
    };

    const targetColor = getTargetColor();

    return (
        <group>
            <mesh
                position={position}
                name="target"
                userData={{ id, onHit, isFriendly, spawnTime }}
            >
                <sphereGeometry args={[0.5 * scale, 12, 12]} />
                <meshBasicMaterial color={targetColor} />
            </mesh>
            {activeMode === 'echolocation' && <PositionalSound position={position} />}
        </group>
    );
}

// Spawner Manager
export default function TargetManager({
    targetScale = 1,
    activeMode = 'static-flick',
}: {
    targetScale?: number;
    activeMode?: string;
}) {
    const { camera } = useThree();
    const spawnDistance = -15;

    const viewport = useThree((state) =>
        state.viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, spawnDistance))
    );

    const maxOffsetX = viewport.width * 0.125;
    const maxOffsetY = viewport.height * 0.075;

    // Spawning 360-degree ring logic outside FOV (103 deg) at Z = 15m radius for Echolocation
    const getRandomPosition = useCallback((): [number, number, number] => {
        if (activeMode === 'echolocation') {
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            const lookAngle = Math.atan2(cameraDir.x, cameraDir.z);

            // Outside FOV spawn range: [51.5 deg, 308.5 deg] offset
            const halfFov = (51.5 * Math.PI) / 180;
            const angleRange = Math.PI * 2 - halfFov * 2;
            const angleOffset = halfFov + Math.random() * angleRange;
            const finalAngle = lookAngle + angleOffset;

            const radius = 14 + Math.random() * 2;
            const x = Math.sin(finalAngle) * radius;
            const z = Math.cos(finalAngle) * radius;
            const y = (Math.random() - 0.5) * 3;
            return [x, y, z];
        }

        const randomX = (Math.random() * 2 - 1) * maxOffsetX;
        const randomY = (Math.random() * 2 - 1) * maxOffsetY;
        return [randomX, randomY, spawnDistance];
    }, [activeMode, camera, maxOffsetX, maxOffsetY]);

    const [targets, setTargets] = useState<{ id: number; pos: [number, number, number]; isFriendly: boolean; spawnTime: number }[]>([]);

    useEffect(() => {
        let listener = camera.children.find((c) => c instanceof THREE.AudioListener);
        if (!listener) {
            camera.add(new THREE.AudioListener());
        }

        setTargets([
            { id: 1, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false, spawnTime: performance.now() },
            { id: 2, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false, spawnTime: performance.now() },
            { id: 3, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false, spawnTime: performance.now() },
        ]);
    }, [activeMode, getRandomPosition, camera]);

    const handleTargetHit = (id: number) => {
        setTargets((current) =>
            current.map((t) =>
                t.id === id
                    ? {
                          id: t.id,
                          pos: getRandomPosition(),
                          isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false,
                          spawnTime: performance.now(),
                      }
                    : t
            )
        );
    };

    return (
        <group>
            {targets.map((target) => (
                <Target
                    key={target.id}
                    id={target.id}
                    position={target.pos}
                    onHit={handleTargetHit}
                    scale={targetScale}
                    isFriendly={target.isFriendly}
                    activeMode={activeMode}
                    spawnTime={target.spawnTime}
                />
            ))}
        </group>
    );
}