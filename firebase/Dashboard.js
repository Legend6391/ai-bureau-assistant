import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { auth, db } from "./config.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User is logged in:", user.uid);

        // Set max date for DOB to today
        const dobInput = document.getElementById("dob");
        if (dobInput) {
            const today = new Date().toISOString().split('T')[0];
            dobInput.setAttribute('max', today);
        }

        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                updateHeader(userData.name);
                updateProfileView(userData);
            } else {
                if (user.displayName) updateHeader(user.displayName);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }

        // Handle Profile Form Submission
        const profileForm = document.getElementById("gov-profile-form");
        if (profileForm) {
            const submitBtn = document.getElementById('submit-profile');

            // Enable button as soon as any field is touched
            const enableSave = () => {
                if (submitBtn) submitBtn.disabled = false;
            };

            // Attach listeners to all inputs
            profileForm.querySelectorAll('input, select, textarea').forEach(input => {
                input.addEventListener('input', enableSave);
                input.addEventListener('change', enableSave);
            });

            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                // Final validation check for required formats (optional but recommended)
                const email = document.getElementById('email')?.value;
                if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    alert("Please enter a valid email address.");
                    return;
                }

                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span class="material-icons-outlined animate-spin text-sm">sync</span> SAVING...';

                const formData = {
                    name: `${document.getElementById('first-name').value} ${document.getElementById('middle-name').value} ${document.getElementById('last-name').value}`.replace(/\s+/g, ' ').trim(),
                    mobile: `+91 ${document.getElementById('mobile').value}`,
                    email: document.getElementById('email').value,
                    dob: document.getElementById('dob').value,
                    age: document.getElementById('age').value,
                    gender: document.getElementById('gender').value,
                    employmentType: document.getElementById('employment-type').value,
                    address: {
                        area: document.getElementById('area').value,
                        city: document.getElementById('city').value,
                        state: document.getElementById('state').value,
                        pincode: document.getElementById('pincode').value
                    },
                    updatedAt: new Date()
                };

                try {
                    await setDoc(doc(db, "users", user.uid), formData, { merge: true });

                    const successMsg = document.getElementById('success-message');
                    if (successMsg) {
                        profileForm.classList.add('hidden');
                        successMsg.classList.remove('hidden');
                        successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }

                    updateProfileView(formData);
                    updateHeader(formData.name);
                } catch (error) {
                    console.error("Error saving profile:", error);
                    alert("Failed to save profile.");
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });
        }

        // Setup Image Previews
        const setupPreview = (inputId, previewId, placeholderId) => {
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            const placeholder = document.getElementById(placeholderId);
            if (!input || !preview || !placeholder) return;

            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        preview.src = ev.target.result;
                        preview.classList.remove('hidden');
                        placeholder.classList.add('hidden');

                        if (inputId === 'photo-v-input') {
                            const headerPic = document.getElementById('header-profile-pic');
                            const headerInit = document.getElementById('header-initials');
                            if (headerPic) {
                                headerPic.src = ev.target.result;
                                headerPic.classList.remove('hidden');
                                if (headerInit) headerInit.classList.add('hidden');
                            }
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        };

        setupPreview('photo-v-input', 'photo-v-preview', 'photo-v-placeholder');
        setupPreview('sig-v-input', 'sig-v-preview', 'sig-v-placeholder');
        setupPreview('marksheet-10-input', 'marksheet-10-preview', 'marksheet-10-placeholder');
        setupPreview('marksheet-12-input', 'marksheet-12-preview', 'marksheet-12-placeholder');
        setupPreview('thumbprint-input', 'thumbprint-preview', 'thumbprint-placeholder');

    } else {
        window.location.href = "login.html";
    }
});

function updateHeader(name) {
    const headerNameElem = document.getElementById("header-user-name");
    const headerInitialsElem = document.getElementById("header-initials");
    if (headerNameElem && name) {
        headerNameElem.textContent = name;
        const nameParts = name.trim().split(" ");
        let initials = nameParts[0][0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : "");
        if (headerInitialsElem) headerInitialsElem.textContent = initials.toUpperCase();
    }
}

function updateProfileView(userData) {
    const placeholder = "Field Empty";
    const setText = (id, val) => {
        const elem = document.getElementById(id);
        if (elem) elem.textContent = val || placeholder;
    };

    setText("view-full-name", userData.name);
    setText("view-email", userData.email);
    setText("view-mobile", userData.mobile || userData.phone);
    setText("view-gender", userData.gender);
    setText("view-dob", userData.dob);
    setText("view-age", userData.age);
    setText("view-employment", userData.employmentType);

    if (userData.address) {
        setText("view-area", userData.address.area);
        setText("view-city", userData.address.city);
        setText("view-state", userData.address.state);
        setText("view-pincode", userData.address.pincode);
    }

    // Fill Edit Form
    const setVal = (id, val) => {
        const elem = document.getElementById(id);
        if (elem) elem.value = val || "";
    };

    if (userData.name) {
        const parts = userData.name.trim().split(" ");
        setVal("first-name", parts[0]);
        if (parts.length === 2) {
            setVal("middle-name", "");
            setVal("last-name", parts[1]);
        } else if (parts.length > 2) {
            setVal("middle-name", parts[1]);
            setVal("last-name", parts.slice(2).join(" "));
        } else {
            setVal("middle-name", "");
            setVal("last-name", "");
        }
    }

    setVal("email", userData.email);
    setVal("mobile", (userData.mobile || userData.phone || "").replace("+91 ", ""));
    setVal("dob", userData.dob);
    setVal("age", userData.age);
    setVal("gender", userData.gender);
    setVal("employment-type", userData.employmentType);

    if (userData.address) {
        setVal("area", userData.address.area);
        setVal("city", userData.address.city);
        setVal("state", userData.address.state);
        setVal("pincode", userData.address.pincode);
    }
}

// Handle Logout
document.querySelectorAll('a[href="login.html"], .logout-btn').forEach(elem => {
    elem.addEventListener('click', (e) => {
        if (elem.textContent.toLowerCase().includes('logout') || elem.querySelector('.material-icons-outlined')?.textContent === 'logout') {
            e.preventDefault();
            signOut(auth).then(() => { window.location.href = "login.html"; });
        }
    });
});
