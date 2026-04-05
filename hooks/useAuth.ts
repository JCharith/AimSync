// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // This Firebase listener fires automatically whenever login state changes
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);

    return {
        user,
        isLoading,
        isLoggedIn: !!user
    };
}