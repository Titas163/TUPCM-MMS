import React, { useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export function SetupAdmin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const handleSetup = async () => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        fullName: 'System Admin',
        mobile: '01700000000',
        email: email,
        role: 'admin',
        language: 'en',
        theme: 'light',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setMsg('Admin created! Go to login.');
    } catch (e: any) {
      setMsg('Error: ' + e.message);
    }
  };

  return (
    <div className="p-10">
      <h2>Setup First Admin</h2>
      <input className="border p-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="border p-2 ml-2" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button className="bg-blue-500 text-white p-2 ml-2" onClick={handleSetup}>Create</button>
      <p>{msg}</p>
    </div>
  );
}
