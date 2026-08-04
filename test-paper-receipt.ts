import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountStr) {
  console.log("NO SERVICE ACCOUNT");
  process.exit(1);
}
const adminApp = initializeApp({ credential: cert(JSON.parse(serviceAccountStr)) });
const db = getFirestore(adminApp, 'ai-studio-19d71396-5a11-4008-8297-e3af12b17af6');

async function run() {
  // Test by just finding an arbitrary non-void record, adding a paper receipt to it, then trying to save another one.
  const snap = await db.collection('donationCollections').limit(1).get();
  if (snap.empty) {
    console.log("No payments to test");
    return;
  }
  const id = snap.docs[0].id;
  await db.collection('donationCollections').doc(id).update({
    paperReceiptNo: '00125'
  });
  console.log("Updated document " + id + " with 00125");
}
run().catch(console.error);
