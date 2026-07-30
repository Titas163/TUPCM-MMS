import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fetch from 'node-fetch';
global.fetch = fetch;

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBMq3CaCePk0cg_e_2FyOqsZpOVRzLFsSM",
  projectId: "gen-lang-client-0461068613",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function test() {
  try {
    await signInWithEmailAndPassword(auth, "01622460991@madrasa.local", "123456");
  } catch (e) {
    console.error(e.code, e.message);
  }
}
test();
