import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = initializeApp({ credential: cert(serviceAccount) });

async function listUsers() {
  const users = await getAuth(app).listUsers();
  for (const user of users.users) {
    console.log(user.email, user.uid);
  }
}
listUsers().then(() => console.log('Done')).catch(console.error);
