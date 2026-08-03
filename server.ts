import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase Admin lazily
let adminApp: App | null = null;
function getAdmin() {
  if (adminApp) return adminApp;
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountStr) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set. Please add it in the Settings menu to use Admin features (like Password Reset).");
  }
  try {
    const serviceAccount = JSON.parse(serviceAccountStr);
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    });
    return adminApp;
  } catch (e) {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON. Please check the formatting.");
  }
}

// API Routes





app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { uid, newPassword } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const firebaseAdmin = getAdmin();
    const decodedToken = await getAuth(firebaseAdmin).verifyIdToken(idToken);
    
    const db = getFirestore(firebaseAdmin, 'ai-studio-19d71396-5a11-4008-8297-e3af12b17af6');
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin only.' });
    }

    await getAuth(firebaseAdmin).updateUser(uid, { password: newPassword });
    await db.collection('users').doc(uid).update({ requirePasswordChange: false });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/api/auth/create-teacher', async (req, res) => {
    try {
    const { email, password, name } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const firebaseAdmin = getAdmin();
    const decodedToken = await getAuth(firebaseAdmin).verifyIdToken(idToken);
    
    const db = getFirestore(firebaseAdmin, 'ai-studio-19d71396-5a11-4008-8297-e3af12b17af6');
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin only.' });
    }

    const userRecord = await getAuth(firebaseAdmin).createUser({
        email,
        password,
        displayName: name
    });

    res.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Create teacher error:", error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/api/auth/delete-user', async (req, res) => {
  try {
    const { uid } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const firebaseAdmin = getAdmin();
    const decodedToken = await getAuth(firebaseAdmin).verifyIdToken(idToken);
    
    const db = getFirestore(firebaseAdmin, 'ai-studio-19d71396-5a11-4008-8297-e3af12b17af6');
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin only.' });
    }

    if (uid === decodedToken.uid) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await getAuth(firebaseAdmin).deleteUser(uid);
    await db.collection('users').doc(uid).delete();

    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/api/auth/update-status', async (req, res) => {
    try {
    const { uid, status } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const firebaseAdmin = getAdmin();
    const decodedToken = await getAuth(firebaseAdmin).verifyIdToken(idToken);
    
    const db = getFirestore(firebaseAdmin, 'ai-studio-19d71396-5a11-4008-8297-e3af12b17af6');
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin only.' });
    }

    // Disable or enable user in Firebase Auth
    await getAuth(firebaseAdmin).updateUser(uid, { disabled: status === 'inactive' });
    
    // Update Firestore
    await db.collection('users').doc(uid).update({ status });
    await db.collection('teachers').doc(uid).update({ status });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Update status error:", error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
