import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const app = initializeApp({ projectId: 'test' });
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, 'my-db-id');
console.log(db._databaseId.database);
