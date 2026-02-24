// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

const reg_btn = document.querySelector(".btn.btn-primary");

reg_btn.addEventListener('click', (event) => {
    event.preventDefault();

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Signed up 
            const user = userCredential.user;
            window.location.href = "../pages/login.html";
            // ...
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;

            let userMessage = "Authentication failed. Please check your credentials.";
            if (email === '' || password === '') {
                userMessage = "Email and password are required.";
            } else if (errorCode === 'auth/email-already-in-use') {
                userMessage = "Account already exists with this email.Please login.";
            } else if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-email') {
                userMessage = "Incorrect email or password. Please try again.";
            }

            document.getElementById('regBtn-error').textContent = userMessage;
            document.getElementById('regBtn-error').style.display = 'block';
            document.getElementById('regBtn-error').style.alignItems = 'center';
        });
})
