import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app, 'ai-studio-19d71396-5a11-4008-8297-e3af12b17af6');

async function fixUser() {
  const users = await getAuth(app).listUsers();
  for (const user of users.users) {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      console.log('Fixing user:', user.email);
      await db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: user.email,
        fullName: 'Admin (Recovered)',
        mobile: '',
        role: 'admin',
        language: 'en',
        theme: 'light',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        requirePasswordChange: false
      });
    }
  }
}
fixUser().then(() => console.log('Done')).catch(console.error);
