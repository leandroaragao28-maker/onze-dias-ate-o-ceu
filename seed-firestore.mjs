// seed-firestore.mjs — grava os 4 personagens + estado de combate no Firestore.
// Uso (uma vez, após o Firestore estar ativo e as regras abertas publicadas):
//   npm install firebase
//   node seed-firestore.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const firebaseConfig = {
  apiKey: "AIzaSyCvDK1OWoC7nB8j9KDi1axkJ5lgqHDacn4",
  authDomain: "onze-dias-ate-o-ceu.firebaseapp.com",
  projectId: "onze-dias-ate-o-ceu",
  storageBucket: "onze-dias-ate-o-ceu.firebasestorage.app",
  messagingSenderId: "664538033951",
  appId: "1:664538033951:web:1b6f91a8d3803b13760a2a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const dados = JSON.parse(readFileSync(new URL('./seed-data.json', import.meta.url), 'utf8'));
for (const p of dados) {
  const obj = { ...p };
  const id = obj.id;
  delete obj.id;
  await setDoc(doc(db, 'personagens', id), obj);
  console.log('ok personagem:', id);
}
await setDoc(doc(db, 'estado', 'combate'), { ativo: false, round: 0, turno: 0, ordem: [] });
console.log('ok estado/combate');
console.log('Seed concluído:', dados.length, 'personagens.');
process.exit(0);
