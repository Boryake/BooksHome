import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCZFNkY47LtR_ygyDE0NDVWGWtaE2MnDLM",
    authDomain: "bookshomes2.firebaseapp.com",
    projectId: "bookshomes2",
    storageBucket: "bookshomes2.appspot.com",
    messagingSenderId: "488764628501",
    appId: "1:488764628501:web:c40e539b43266a1564f81c",
    measurementId: "G-CWB8VKTHE7"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };