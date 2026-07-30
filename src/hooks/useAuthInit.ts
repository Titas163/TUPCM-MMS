import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Settings as SettingsType } from '../types';
import { useAppStore } from '../store';
import { authService } from '../services/authService';

export function useAuthInit() {
  const { setUser, setIsLoading, setSettings, setLanguage, setTheme } = useAppStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userProfile = await authService.getUserProfile(firebaseUser.uid);
          
          // Fetch settings
          try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
            if (settingsDoc.exists()) {
              const s = settingsDoc.data() as SettingsType;
              setSettings(s);
              if (s.defaultLanguage) setLanguage(s.defaultLanguage);
              if (s.defaultTheme) setTheme(s.defaultTheme);
            }
          } catch(e) { console.error(e); }
          
          if (userProfile && userProfile.active) {
            setUser(userProfile);
          } else {
            setUser(null);
            await authService.logout();
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setIsLoading]);
}
