// Import the functions you need from the SDKs you need
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { auth, db } from "./config.js";

const reg_btn = document.querySelector(".btn.btn-primary");

reg_btn.addEventListener('click', async (event) => {
    event.preventDefault();

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const name = document.getElementById('fname').value;
    const phone = document.getElementById('phone').value;
    const errorDiv = document.getElementById('regBtn-error');

    // Reset error display
    errorDiv.style.display = 'none';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save user details to Firestore using UID as document ID
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            phone: phone,
            createdAt: new Date()
        });

        console.log("User registered and details saved to Firestore");
        window.location.href = "../pages/login.html";

    } catch (error) {
        const errorCode = error.code;
        console.error("Registration error:", error);

        let userMessage = "Authentication failed. Please check your credentials.";
        if (email === '' || password === '') {
            userMessage = "Email and password are required.";
        } else if (errorCode === 'auth/email-already-in-use') {
            userMessage = "Account already exists with this email. Please login.";
        } else if (errorCode === 'auth/weak-password') {
            userMessage = "Password should be at least 6 characters.";
        } else if (errorCode === 'auth/invalid-email') {
            userMessage = "Invalid email address.";
        }

        errorDiv.textContent = userMessage;
        errorDiv.style.display = 'block';
        errorDiv.style.alignItems = 'center';
    }
});


