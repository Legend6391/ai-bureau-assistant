// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
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

const submit = document.querySelector('#step-1 .btn-primary');

submit.addEventListener('click', () => {
    event.preventDefault();

    const loginId = document.getElementById('login-id').value;
    const pass = document.getElementById('password').value;
    const consent = document.getElementById('consent').checked;
    const errorElement = document.getElementById('id-error');

    const auth = getAuth();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let isValid = true;

    if (!emailRegex.test(loginId)) {
        errorElement.style.display = 'block';
        isValid = false;
    } else {
        errorElement.style.display = 'none';
    }

    if (!consent) {
        document.getElementById('login-error').textContent = "Please provide consent to proceed.";
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-error').style.alignItems = 'center';
        isValid = false;
    }

    if (isValid) {
        // This function will be called by the Firebase module script
        window.dispatchEvent(new CustomEvent('login-attempt', {
            detail: { loginId, pass }
        }));
    }

    if (isValid) {
        signInWithEmailAndPassword(auth, loginId, pass)
            .then((userCredential) => {
                // Signed in 
                const user = userCredential.user;
                window.location.href = "../pages/dashboard.html";
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;

                let userMessage = "Authentication failed. Please check your credentials.";
                if (errorCode === 'auth/user-not-found') {
                    userMessage = "No account found with this email.";
                } else if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-email') {
                    userMessage = "Incorrect email or password. Please try again.";
                }

                document.getElementById('login-error').textContent = userMessage;
                document.getElementById('login-error').style.display = 'block';
                document.getElementById('login-error').style.alignItems = 'center';
                document.getElementById('login-id').value = '';
                document.getElementById('password').value = '';
            });
    }
});
