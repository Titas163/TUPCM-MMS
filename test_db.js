import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app, 'ai-studio-19d71396-5a11-4008-8297-e3af12b17af6');

async function test() {
  const snapshot = await db.collection('users').get();
  snapshot.forEach(doc => console.log(doc.id, '=>', doc.data()));
}
test().then(() => console.log('Done')).catch(console.error);
