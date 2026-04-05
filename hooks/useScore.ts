import { useState, useCallback } from 'react';

export const useScore = () => {
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);

    const addHit = useCallback((points: number) => {
        setHits(prev => prev + 1);
        setScore(prev => prev + points);
    }, []);

    const addMiss = useCallback((penalty: number) => {
        setMisses(prev => prev + 1);
        setScore(prev => Math.max(0, prev - penalty));
    }, []);

    const resetScore = useCallback(() => {
        setScore(0);
        setHits(0);
        setMisses(0);
    }, []);

    return { score, hits, misses, addHit, addMiss, resetScore };
};