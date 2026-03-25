// Import the functions you need from the SDKs you need
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { auth } from "./config.js";

const submit = document.querySelector('#login-btn');

submit.addEventListener('click', (event) => {
    event.preventDefault();

    const loginId = document.getElementById('login-id').value.trim();
    const pass = document.getElementById('password').value;
    const consent = document.getElementById('consent').checked;
    const errorElement = document.getElementById('id-error');
    const loginError = document.getElementById('login-error');

    // Reset errors
    errorElement.style.display = 'none';
    loginError.style.display = 'none';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!loginId || !pass) {
        loginError.textContent = "Email and password are required.";
        loginError.style.display = 'block';
        return;
    }

    if (!emailRegex.test(loginId)) {
        errorElement.style.display = 'block';
        return;
    }

    if (!consent) {
        loginError.textContent = "Please provide consent to proceed.";
        loginError.style.display = 'block';
        return;
    }

    // Disable button during attempt
    const originalText = submit.innerHTML;
    submit.disabled = true;
    submit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';

    signInWithEmailAndPassword(auth, loginId, pass)
        .then((userCredential) => {
            window.location.href = "../pages/dashboard.html";
        })
        .catch((error) => {
            const errorCode = error.code;
            console.error("Login error:", error);

            let userMessage = "Authentication failed. Please check your credentials.";
            if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
                userMessage = "Incorrect email or password. Please try again.";
            } else if (errorCode === 'auth/too-many-requests') {
                userMessage = "Too many failed attempts. Please try again later.";
            }

            loginError.textContent = userMessage;
            loginError.style.display = 'block';

            // Re-enable button
            submit.disabled = false;
            submit.innerHTML = originalText;

            // Clear password
            document.getElementById('password').value = '';
        });
});
