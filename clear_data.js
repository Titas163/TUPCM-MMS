import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);
const db = getFirestore(app, 'ai-studio-19d71396-5a11-4008-8297-e3af12b17af6');

async function clearData() {
  const users = await auth.listUsers();
  for (const user of users.users) {
    if (user.email.endsWith('@madrasa.local') && user.email !== 'admin@madrasa.local') {
      console.log('Deleting auth user:', user.email);
      await auth.deleteUser(user.uid);
      
      console.log('Deleting firestore user doc for:', user.uid);
      await db.collection('users').doc(user.uid).delete();
      
      console.log('Deleting firestore teacher doc for:', user.uid);
      await db.collection('teachers').doc(user.uid).delete();
    }
  }
  
  // Update admin password to 'Admin@12345' just in case
  const adminUser = users.users.find(u => u.email === 'admin@madrasa.local');
  if (adminUser) {
    await auth.updateUser(adminUser.uid, { password: 'Admin@12345' });
    console.log('Admin password reset to Admin@12345');
  }
}

clearData().then(() => console.log('All clear!')).catch(console.error);
