// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBWBqzXb-xnyvvcMSvwyxuM-g2cenLzna0",
    authDomain: "aipersonalbureaucracyassistant.firebaseapp.com",
    projectId: "aipersonalbureaucracyassistant",
    storageBucket: "aipersonalbureaucracyassistant.firebasestorage.app",
    messagingSenderId: "972045235604",
    appId: "1:972045235604:web:e49092343b57fd18df8b81",
    measurementId: "G-8XMWCK41JP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
