const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function fixUser() {
  const users = await admin.auth().listUsers();
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
