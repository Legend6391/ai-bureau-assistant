import { auth } from "../firebase/config.js";
import { supabase } from "./supabaseConfig.js";
import { uploadDocument, ensureUserBucket } from "./storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    
    // UI Elements
    const uploadInput = document.getElementById('doc-upload-input');
    const dropzone = document.getElementById('doc-upload-zone');
    const progressContainer = document.getElementById('doc-upload-progress-container');
    const progressBar = document.getElementById('doc-upload-progress-bar');
    const progressText = document.getElementById('doc-upload-progress-text');
    const dynamicDocList = document.getElementById('dynamic-doc-list');
    const emptyState = document.getElementById('empty-doc-state');

    // To prevent redundant listeners or fetches if we already fetched
    let hasFetchedOnce = false;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            
            try {
                // Provision or fetch the unique storage bucket for this user
                const bucketId = await ensureUserBucket(user.uid, user.email);
                currentUser.bucketId = bucketId; 
                console.log("Storage vault initialized:", bucketId);

                // Now that the bucket is ready, if we're on the documents section, fetch them
                if (window.location.hash.includes('documents') && !hasFetchedOnce) {
                    fetchAndDisplayDocuments();
                    hasFetchedOnce = true;
                }
            } catch (err) {
                console.error("Storage initialization failed:", err);
                alert("Warning: Secure storage vault could not be initialized. Some features may be unavailable.");
            }

            // Listen when user navigates specifically to Documents
            const navDocs = document.getElementById('nav-documents');
            if (navDocs) {
                navDocs.addEventListener('click', () => {
                    if (!hasFetchedOnce && currentUser && currentUser.bucketId) {
                        fetchAndDisplayDocuments();
                        hasFetchedOnce = true;
                    }
                });
            }
        } else {
            currentUser = null;
        }
    });

    const fetchAndDisplayDocuments = async () => {
        if (!currentUser || !currentUser.bucketId) return;
        
        dynamicDocList.innerHTML = ''; // clear
        
        try {
            // Fetch metadata from 'documents' table
            const { data: snapshot, error } = await supabase
                .from('documents')
                .select('*')
                .eq('user_id', currentUser.uid)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            if (!snapshot || snapshot.length === 0) {
                emptyState.classList.remove('hidden');
                dynamicDocList.classList.add('hidden');
            } else {
                emptyState.classList.add('hidden');
                dynamicDocList.classList.remove('hidden');
                
                snapshot.forEach((data) => {
                    const card = createDocumentCard(data.id, data);
                    dynamicDocList.appendChild(card);
                });
            }
        } catch (error) {
            console.error("Error fetching documents:", error);
            alert("Failed to securely retrieve your documents from Supabase.");
        }
    };

    const createDocumentCard = (docId, data) => {
        const div = document.createElement('div');
        div.className = "flex flex-col md:flex-row items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-primary transition-all group bg-slate-50/50 dark:bg-slate-800/50";
        div.id = `doc-card-${docId}`;

        const safeFileType = data.fileType || '';
        const safeFileName = data.fileName || 'Unknown File';
        const isPdf = safeFileType.includes('pdf');
        const iconClasses = isPdf ? 'bg-red-50 text-red-600 dark:bg-red-900/30' : 'bg-blue-50 text-primary dark:bg-blue-900/30';
        const iconName = isPdf ? 'picture_as_pdf' : 'image';
        
        const dateStr = data.created_at ? new Date(data.created_at).toLocaleDateString() : 'Unknown Date';
        const rawFileName = safeFileName.length > 30 ? safeFileName.substring(0, 30) + "..." : safeFileName;

        div.innerHTML = `
            <div class="h-12 w-12 rounded-xl flex items-center justify-center ${iconClasses} shrink-0">
                <span class="material-icons-outlined">${iconName}</span>
            </div>
            <div class="flex-1 text-center md:text-left w-full overflow-hidden">
                <h4 class="font-bold dark:text-white uppercase text-xs truncate" title="${safeFileName}">${rawFileName}</h4>
                <p class="text-[10px] text-slate-400 mt-1 uppercase font-semibold tracking-wider">Type: ${safeFileType.split('/')[1] || safeFileType || 'UNKNOWN'} &bull; Uploaded: ${dateStr}</p>
            </div>
            <div class="flex items-center gap-2 mt-3 md:mt-0 w-full md:w-auto justify-center">
                <button data-url="${data.fileURL}" class="btn-view-doc px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-primary dark:text-blue-400 text-[10px] font-bold rounded-lg hover:bg-slate-50 transition-colors uppercase flex items-center gap-1">
                    <span class="material-icons-outlined text-[14px]">visibility</span> View
                </button>
                <button data-url="${data.fileURL}" data-name="${safeFileName}" class="btn-download-doc px-4 py-2 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors uppercase shadow-md shadow-primary/20 flex items-center gap-1">
                    <span class="material-icons-outlined text-[14px]">download</span> Download
                </button>
                <button data-id="${docId}" class="btn-delete-doc p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                    <span class="material-icons-outlined text-[18px]">delete</span>
                </button>
            </div>
        `;

        // Event Listeners
        div.querySelector('.btn-view-doc').addEventListener('click', (e) => {
            window.open(e.currentTarget.dataset.url, '_blank');
        });

        div.querySelector('.btn-download-doc').addEventListener('click', (e) => {
            const url = e.currentTarget.dataset.url;
            const link = document.createElement('a');
            link.href = url;
            link.download = e.currentTarget.dataset.name;
            link.target = "_blank"; // Fallback
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        div.querySelector('.btn-delete-doc').addEventListener('click', async (e) => {
            const targetDocId = e.currentTarget.dataset.id;
            if (!confirm("Are you sure you want to permanently delete this document from your vault?")) return;

            const deleteBtn = e.currentTarget;
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<span class="material-icons-outlined text-[18px] animate-spin">sync</span>';

            try {
                const { data: deleted, error } = await supabase
                    .from('documents')
                    .delete()
                    .eq('id', targetDocId)
                    .select();

                if (error) throw error;

                // If no rows returned, re-fetch to confirm the row is truly gone
                if (!deleted || deleted.length === 0) {
                    const { data: check } = await supabase
                        .from('documents')
                        .select('id')
                        .eq('id', targetDocId)
                        .maybeSingle();

                    if (check) {
                        throw new Error("Delete was not applied. Please ensure the 'documents' table allows DELETE for the anon role in Supabase.");
                    }
                }

                // ✅ Confirmed deleted — update the UI
                document.getElementById(`doc-card-${targetDocId}`)?.remove();
                window._govAiDecrementDocCount?.();

                if (dynamicDocList.children.length === 0) {
                    emptyState.classList.remove('hidden');
                    dynamicDocList.classList.add('hidden');
                }

            } catch (err) {
                console.error("Delete failed:", err);
                alert("Failed to delete document:\n" + err.message);
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<span class="material-icons-outlined text-[18px]">delete</span>';
            }
        });

        return div;
    };

    const handleUploadEvent = async (file) => {
        if (!file || !currentUser) return;
        
        // Validation rules are basically mirrored in storage.js, but let's UI feedback early here
        const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!ALLOWED_TYPES.includes(file.type)) {
            alert("Security Error: Only PDF, JPG, or PNG files are supported for official documents.");
            return;
        }

        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            alert("Size Error: Document exceeds the 5MB limit. Please compress and retry.");
            return;
        }

        // UI Feedback: Show file name and preview in the dropzone
        const dropzoneIcon = dropzone.querySelector('.material-icons-outlined');
        const dropzoneTitle = dropzone.querySelector('h4');
        const dropzoneDesc = dropzone.querySelector('p');
        
        const originalIcon = dropzoneIcon.textContent;
        const originalTitle = dropzoneTitle.textContent;
        const originalDesc = dropzoneDesc.textContent;
        
        dropzoneTitle.textContent = file.name;
        dropzoneDesc.textContent = "Uploading securely...";
        
        // Show preview if image
        let previewImg = dropzone.querySelector('img.preview-img');
        if (!previewImg) {
            previewImg = document.createElement('img');
            previewImg.className = 'preview-img h-16 w-16 object-cover rounded-xl mb-4 hidden';
            dropzone.insertBefore(previewImg, dropzoneTitle);
        }
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewImg.classList.remove('hidden');
                dropzone.querySelector('.bg-blue-50').classList.add('hidden'); // hide the icon circle
            };
            reader.readAsDataURL(file);
        } else {
            dropzoneIcon.textContent = "description";
        }
        
        // Setup Progress UI
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '20%';
        progressText.textContent = '20%';
        const uploadLabel = progressContainer.querySelector('span.text-slate-500');
        if (uploadLabel) uploadLabel.textContent = `Uploading ${file.name}...`;

        try {
            // Upload physics via existing storage.js helpers
            progressBar.style.width = '60%';
            progressText.textContent = '60%';
            
            // USE THE USER'S PRIVATE BUCKET ID
            const uploadResult = await uploadDocument(file, currentUser.bucketId);
            
            progressBar.style.width = '90%';
            progressText.textContent = '90%';

            // Create metadata record in Supabase Database
            const { data: newDocs, error: insertError } = await supabase.from('documents').insert([{
                user_id: currentUser.uid,
                fileName: file.name,
                fileType: file.type,
                fileURL: uploadResult.downloadURL
            }]).select();
            if (insertError) throw insertError;

            progressBar.style.width = '100%';
            progressText.textContent = 'Complete';
            
            // CONFIRMATION UI
            dropzoneTitle.textContent = "Upload Complete!";
            dropzoneDesc.textContent = "Document securely added to your vault.";
            dropzoneIcon.textContent = "check_circle";
            dropzone.classList.add('border-green-500', 'bg-green-50');
            
            // Wait brief visual
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            await sleep(2000);

            // RESET UI
            progressContainer.classList.add('hidden');
            progressBar.style.width = '0%';
            
            dropzoneTitle.textContent = originalTitle;
            dropzoneDesc.textContent = originalDesc;
            dropzoneIcon.textContent = originalIcon;
            dropzone.classList.remove('border-green-500', 'bg-green-50');
            if (previewImg) previewImg.classList.add('hidden');
            dropzone.querySelector('.bg-blue-50').classList.remove('hidden');
            
            // Immediately append it to UI to bypass fetching again
            const optimisticData = {
                fileName: file.name,
                fileType: file.type,
                fileURL: uploadResult.downloadURL,
                created_at: new Date().toISOString()
            };
            
            const newDocId = (newDocs && newDocs.length > 0) ? newDocs[0].id : `doc-${Date.now()}`;
            const card = createDocumentCard(newDocId, optimisticData);
            
            if (emptyState && !emptyState.classList.contains('hidden')) {
                emptyState.classList.add('hidden');
                dynamicDocList.classList.remove('hidden');
            }
            dynamicDocList.prepend(card); // insert at top
            // Update the overview stat card with new count
            window._govAiIncrementDocCount?.();

        } catch (error) {
            console.error("Upload error", error);
            alert("Error: " + error.message);
            progressContainer.classList.add('hidden');
            
            // Restore UI on error
            dropzoneTitle.textContent = originalTitle;
            dropzoneDesc.textContent = originalDesc;
            dropzoneIcon.textContent = originalIcon;
            if (previewImg) previewImg.classList.add('hidden');
            dropzone.querySelector('.bg-blue-50').classList.remove('hidden');
        } finally {
            if (uploadInput) uploadInput.value = ""; // clear
        }
    };

    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleUploadEvent(e.target.files[0]);
            }
        });
    }

    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-primary', 'bg-blue-50/50');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-primary', 'bg-blue-50/50');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-primary', 'bg-blue-50/50');
            if (e.dataTransfer.files.length > 0) {
                handleUploadEvent(e.dataTransfer.files[0]);
            }
        });
    }

});
