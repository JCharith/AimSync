'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeaponStore } from '@/store/weaponStore';
import { useRecoil } from '@/hooks/UseRecoil';

interface TrackingTargetProps {
    id: string;
    baseDistance?: number;
    activeMode?: string;
}

const ZERO_VECTOR = new THREE.Vector3(0, 0, 0);

export default function TrackingTarget({ id, baseDistance = -15, activeMode = 'continuous-track' }: TrackingTargetProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const activeWeapon = useWeaponStore((state) => state.activeWeapon);
    const { getShotTrajectory } = useRecoil(activeWeapon);

    // Random frequencies & radii for Lissajous trajectory
    const { speedX, speedY, speedZ, radiusX, radiusY, radiusZ } = useMemo(() => ({
        speedX: Math.random() * 1.5 + 0.6,
        speedY: Math.random() * 1.5 + 0.6,
        speedZ: Math.random() * 1.0 + 0.3,
        radiusX: Math.random() * 6 + 4,
        radiusY: Math.random() * 4 + 2.5,
        radiusZ: Math.random() * 4 + 2,
    }), []);

    const evasionOffset = useRef(new THREE.Vector3(0, 0, 0));

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        const t = state.clock.getElapsedTime();

        // Lissajous curve base movement
        const xBase = Math.sin(t * speedX) * radiusX;
        const yBase = Math.cos(t * speedY) * radiusY;
        const zBase = baseDistance + Math.sin(t * speedZ) * radiusZ;

        let finalX = xBase;
        let finalY = yBase;
        let finalZ = zBase;

        // Recoil-Reactive Evasion Physics Protocol
        if (activeMode === 'recoil-reactive' || activeMode === 'recoil-evasion') {
            const recoil = getShotTrajectory();
            const kickY = recoil.kickY || 0;
            const kickX = recoil.kickX || 0;
            const offsetX = recoil.offsetX || 0;
            const offsetY = recoil.offsetY || 0;

            const sprayMagnitude = Math.sqrt(kickX * kickX + kickY * kickY);
            const bloomMagnitude = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

            // Active counter-spray dodge trigger
            if (sprayMagnitude > 0.04 || bloomMagnitude > 0.004) {
                // Target shifts velocity and dives away from recoil kick direction
                const dodgeDirX = kickX > 0 ? -1 : 1;
                const dodgeDirY = kickY > 0 ? -1.2 : 0.8; // Evasive dive downwards

                evasionOffset.current.x += (dodgeDirX * 16.0 + Math.sin(t * 18) * 6.0) * delta;
                evasionOffset.current.y += (dodgeDirY * 14.0) * delta;
            } else {
                // Smooth recovery back to base Lissajous path
                evasionOffset.current.lerp(ZERO_VECTOR, 0.08);
            }

            // Clamp evasion bounds to prevent target from exiting viewport bounds
            evasionOffset.current.x = Math.max(-9, Math.min(9, evasionOffset.current.x));
            evasionOffset.current.y = Math.max(-7, Math.min(7, evasionOffset.current.y));

            finalX += evasionOffset.current.x;
            finalY += evasionOffset.current.y;
        }

        meshRef.current.position.set(finalX, finalY, finalZ);
    });

    return (
        <mesh
            ref={meshRef}
            name="tracking-target"
            userData={{ id }}
        >
            <sphereGeometry args={[0.5, 12, 12]} />
            <meshBasicMaterial color={activeMode === 'recoil-evasion' || activeMode === 'recoil-reactive' ? '#ff6600' : '#FF9900'} />
        </mesh>
    );
}