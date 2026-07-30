import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { User } from '../types';
import { auditService } from './auditService';

export const authService = {
  login: async (identifier: string, password: string): Promise<User> => {
    let email = identifier.trim();
    
    // Custom logic for Admin and Phone numbers
    if (email.toLowerCase() === 'admin') {
      email = 'admin@madrasa.local';
    } else if (!email.includes('@')) {
      const numericOnly = email.replace(/\D/g, '');
      if (numericOnly.length > 0) {
        email = `${numericOnly}@madrasa.local`;
      }
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        if (email === 'admin@madrasa.local') {
          const newAdmin: User = {
            uid: userCredential.user.uid,
            email: 'admin@madrasa.local',
            fullName: 'Super Admin',
            mobile: '',
            role: 'admin',
            language: 'en',
            theme: 'light',
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            requirePasswordChange: true
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), newAdmin);
          return newAdmin;
        }
        await signOut(auth);
        throw new Error('User profile not found in database.');
      }
      
      const userData = userDoc.data() as User;
      
      if (userData.active === false) {
        await signOut(auth);
        throw new Error('Your account is inactive. Please contact admin.');
      }
      
      // Update last login
      await updateDoc(doc(db, 'users', userCredential.user.uid), {
        lastLogin: Date.now()
      });
      
      // Log audit
      await auditService.log(userCredential.user.uid, 'LOGIN', 'AUTH');
      
      return { ...userData, uid: userCredential.user.uid };
    } catch (error: any) {
      // If Admin account doesn't exist yet, create it on the fly
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        if (email === 'admin@madrasa.local' && password === 'Admin@12345') {
            try {
                const newCreds = await createUserWithEmailAndPassword(auth, email, password);
                const newAdmin: User = {
                  uid: newCreds.user.uid,
                  email: 'admin@madrasa.local',
                  fullName: 'Super Admin',
                  mobile: '',
                  role: 'admin',
                  language: 'en',
                  theme: 'light',
                  active: true,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  requirePasswordChange: true
                };
                await setDoc(doc(db, 'users', newCreds.user.uid), newAdmin);
                return newAdmin;
            } catch (createError) {
                console.error("Failed to auto-create admin", createError);
                throw error; // Throw original error if creation fails
            }
        }
      }
      throw error;
    }
  },
  
  logout: async () => {
    await signOut(auth);
  },
  
  getUserProfile: async (uid: string): Promise<User | null> => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return { ...userDoc.data(), uid } as User;
    }
    return null;
  }
};
