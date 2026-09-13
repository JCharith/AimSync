import React from 'react';
import ResolutionGuard from '@/components/guards/ResolutionGuard';

export default function GameLayout({ children }: { children: React.ReactNode }) {
    return <ResolutionGuard>{children}</ResolutionGuard>;
}
