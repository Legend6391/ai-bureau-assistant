import { auth } from "../firebase/config.js";
import { uploadDocument } from "./storage.js";
import { supabase } from "./supabaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let selectedFile = null;
    let currentProfileData = {};

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            try {
                const { data, error } = await supabase.from('profiles').select('*').eq('id', user.uid).maybeSingle();
                if (data) {
                    currentProfileData = data;
                } else if (error) {
                    throw error;
                }
            } catch (err) {
                console.error("Failed to fetch user data for OCR from Supabase", err);
            }
        }
    });

    // Elements
    const dropzone = document.getElementById('ocr-dropzone');
    const fileInput = document.getElementById('ocr-file-input');
    const uploadText = document.getElementById('ocr-upload-text');
    const uploadIcon = document.getElementById('ocr-upload-icon');
    const selectedFilename = document.getElementById('ocr-selected-filename');
    const errorMsg = document.getElementById('ocr-error-msg');
    const btnStart = document.getElementById('ocr-btn-start');
    const autofillCheck = document.getElementById('ocr-autofill-check');

    // Panels
    const step1 = document.getElementById('ocr-step-1');
    const step2 = document.getElementById('ocr-step-2');
    const step3 = document.getElementById('ocr-step-3');
    const stepSuccess = document.getElementById('ocr-step-success');

    // Progress
    const progressBar = document.getElementById('ocr-progress-bar');
    const progressText = document.getElementById('ocr-progress-text');
    const statusTitle = document.getElementById('ocr-status-title');
    const statusDesc = document.getElementById('ocr-status-desc');

    // Review
    const resultsBody = document.getElementById('ocr-results-body');
    const btnConfirm = document.getElementById('ocr-btn-confirm');
    const btnCancel = document.getElementById('ocr-btn-cancel');

    // State
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    let extractedDataModel = {}; // Built during parsing

    const validateFile = (file) => {
        if(!errorMsg) return false;
        errorMsg.classList.add('hidden');
        if (!ALLOWED_TYPES.includes(file.type)) {
            showError("Invalid file type. Please upload a PDF, PNG, or JPG.");
            return false;
        }
        if (file.size > MAX_FILE_SIZE) {
            showError("File too large. Maximum size is 5MB.");
            return false;
        }
        return true;
    };

    const showError = (msg) => {
        if(!errorMsg) return;
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
        selectedFile = null;
        updateFileUI();
    };

    const updateFileUI = () => {
        if (!uploadText) return;
        if (selectedFile) {
            uploadText.textContent = "File Selected";
            uploadIcon.textContent = "task";
            uploadIcon.parentElement.classList.replace('bg-blue-50', 'bg-green-50');
            uploadIcon.parentElement.classList.replace('text-primary', 'text-green-600');
            selectedFilename.textContent = selectedFile.name;
            selectedFilename.classList.remove('hidden');
            btnStart.disabled = false;
        } else {
            uploadText.textContent = "Drag & Drop or Click to Browse";
            uploadIcon.textContent = "upload_file";
            uploadIcon.parentElement.classList.replace('bg-green-50', 'bg-blue-50');
            uploadIcon.parentElement.classList.replace('text-green-600', 'text-primary');
            selectedFilename.textContent = "";
            selectedFilename.classList.add('hidden');
            btnStart.disabled = true;
        }
    };

    const showStep = (stepNumber) => {
        [step1, step2, step3, stepSuccess].forEach(p => { if(p) p.classList.add('hidden') });
        document.querySelectorAll('.ocr-step-ind').forEach((ind, idx) => {
            if (idx + 1 <= stepNumber) ind.classList.remove('opacity-50');
            else ind.classList.add('opacity-50');
        });

        if (stepNumber === 1 && step1) step1.classList.remove('hidden');
        if (stepNumber === 2 && step2) step2.classList.remove('hidden');
        if (stepNumber === 3 && step3) step3.classList.remove('hidden');
        if (stepNumber === 4 && stepSuccess) stepSuccess.classList.remove('hidden');
    };

    // File events
    if(fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                if (validateFile(e.target.files[0])) {
                    selectedFile = e.target.files[0];
                    updateFileUI();
                }
            }
        });
    }

    if(dropzone) {
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
                if (validateFile(e.dataTransfer.files[0])) {
                    selectedFile = e.dataTransfer.files[0];
                    if(fileInput) fileInput.files = e.dataTransfer.files; 
                    updateFileUI();
                }
            }
        });
    }

    if(btnStart) {
        btnStart.addEventListener('click', async () => {
            if (!selectedFile || !currentUser) return;
            
            showStep(2);
            
            try {
                if (autofillCheck && autofillCheck.checked) {
                    if (selectedFile.type === 'application/pdf') {
                        if(statusTitle) statusTitle.textContent = "Converting PDF...";
                        if(statusDesc) statusDesc.textContent = "Rendering PDF pages to images for text extraction.";
                        const images = await pdfToImages(selectedFile);
                        await runOCR(images);
                    } else {
                        await runOCR(selectedFile);
                    }
                } else {
                    await uploadOnlyFlow();
                }
            } catch (err) {
                console.error("Processing error", err);
                alert("Processing failed: " + err.message);
                showStep(1);
            }
        });
    }

    async function pdfToImages(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const images = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            images.push(canvas.toDataURL('image/png'));
        }
        return images;
    }

    if(btnCancel) {
        btnCancel.addEventListener('click', () => {
            selectedFile = null;
            updateFileUI();
            if(autofillCheck) autofillCheck.checked = false;
            showStep(1);
        });
    }

    if(btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            btnConfirm.disabled = true;
            btnConfirm.innerHTML = '<span class="material-icons-outlined animate-spin text-sm">rotate_right</span> Saving...';
            
            try {
                // 0. Check if file already exists in database
                const { data: existingFile } = await supabase
                    .from('documents')
                    .select('id, fileURL')
                    .eq('user_id', currentUser.uid)
                    .eq('fileName', selectedFile.name)
                    .maybeSingle();

                let uploadResult;
                if (existingFile) {
                    console.log("File already exists, using existing URL");
                    uploadResult = { downloadURL: existingFile.fileURL };
                } else {
                    // 1. Upload to Supabase Storage
                    uploadResult = await uploadDocument(selectedFile, currentUser.uid);
                    
                    // 1.5. Add to documents table (matching documents.js)
                    await supabase.from('documents').insert([{
                        user_id: currentUser.uid,
                        fileName: selectedFile.name,
                        fileType: selectedFile.type,
                        fileURL: uploadResult.downloadURL
                    }]);
                }
                
                // 2. Determine final payload based on user's choices in Step 3
                const finalDataToSave = {};
                document.querySelectorAll('.ocr-field-row').forEach(row => {
                    const fieldKey = row.dataset.key;
                    const extractVal = row.dataset.extract;
                    const selectedRadio = row.querySelector('input[type="radio"]:checked');
                    if (selectedRadio) {
                        if (selectedRadio.value === 'extract') {
                            finalDataToSave[fieldKey] = extractVal;
                        } 
                    } else if(!currentProfileData[fieldKey]) {
                        finalDataToSave[fieldKey] = extractVal;
                    }
                });

                // 3. Prepare Supabase payload
                const userUpdatePayload = {
                    id: currentUser.uid,
                    ...finalDataToSave,
                    uploadedDocuments: Array.isArray(currentProfileData.uploadedDocuments) 
                        ? (currentProfileData.uploadedDocuments.includes(uploadResult.downloadURL) 
                            ? currentProfileData.uploadedDocuments 
                            : [...currentProfileData.uploadedDocuments, uploadResult.downloadURL])
                        : [uploadResult.downloadURL],
                    updatedAt: new Date().toISOString()
                };

                // Add combined 'name' field if missing or being updated
                if (finalDataToSave.firstName || finalDataToSave.lastName) {
                    const fName = finalDataToSave.firstName || currentProfileData.firstName || "";
                    const lName = finalDataToSave.lastName || currentProfileData.lastName || "";
                    userUpdatePayload.name = `${fName} ${lName}`.trim();
                }

                const { error: updateError } = await supabase.from('profiles').upsert(userUpdatePayload);
                if(updateError) throw updateError;
                
                Object.assign(currentProfileData, finalDataToSave);
                showStep(4);

            } catch (error) {
                console.error(error);
                alert("Error saving document: " + error.message);
                btnConfirm.disabled = false;
                btnConfirm.innerHTML = '<span class="material-icons-outlined text-sm">check_circle</span> Confirm & Save to Profile';
            }
        });
    }

    async function uploadOnlyFlow() {
        showStep(2);
        if(statusTitle) statusTitle.textContent = "Uploading Securely...";
        if(statusDesc) statusDesc.textContent = "Checking for existing records and uploading document.";
        if(progressBar) progressBar.style.width = "30%";
        if(progressText) progressText.textContent = "30%";
        
        try {
            // Check if file exists
            const { data: existingFile } = await supabase
                .from('documents')
                .select('id, fileURL')
                .eq('user_id', currentUser.uid)
                .eq('fileName', selectedFile.name)
                .maybeSingle();

            let uploadResult;
            if (existingFile) {
                uploadResult = { downloadURL: existingFile.fileURL };
                if(progressBar) progressBar.style.width = "70%";
                if(progressText) progressText.textContent = "70%";
            } else {
                uploadResult = await uploadDocument(selectedFile, currentUser.uid);
                if(progressBar) progressBar.style.width = "60%";
                if(progressText) progressText.textContent = "60%";
                
                await supabase.from('documents').insert([{
                    user_id: currentUser.uid,
                    fileName: selectedFile.name,
                    fileType: selectedFile.type,
                    fileURL: uploadResult.downloadURL
                }]);
                if(progressBar) progressBar.style.width = "80%";
                if(progressText) progressText.textContent = "80%";
            }

            const { error: updateError } = await supabase.from('profiles').upsert({
                id: currentUser.uid,
                uploadedDocuments: Array.isArray(currentProfileData.uploadedDocuments) 
                    ? (currentProfileData.uploadedDocuments.includes(uploadResult.downloadURL) 
                        ? currentProfileData.uploadedDocuments 
                        : [...currentProfileData.uploadedDocuments, uploadResult.downloadURL])
                    : [uploadResult.downloadURL],
                updatedAt: new Date().toISOString()
            });
            
            if(updateError) throw updateError;

            if(progressBar) progressBar.style.width = "100%";
            if(progressText) progressText.textContent = "100%";

            setTimeout(() => { showStep(4); }, 600);
        } catch(e) {
            console.error(e);
            alert("Upload failed: " + e.message);
            showStep(1);
        }
    }

    async function runOCR(input) {
        if(statusTitle) statusTitle.textContent = "Initializing OCR Engine...";
        if(statusDesc) statusDesc.textContent = "Loading Tesseract.js language models and warming up.";
        if(progressBar) progressBar.style.width = "0%";
        if(progressText) progressText.textContent = "0%";
        
        try {
            if (!window.Tesseract) throw new Error("Tesseract library failed to load");
            const worker = await window.Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        if(statusTitle) statusTitle.textContent = "Scanning Document Data...";
                        if(statusDesc) statusDesc.textContent = "Extracting raw patterns and textual information securely in-browser.";
                        const pct = Math.floor(m.progress * 100);
                        if(progressBar) progressBar.style.width = `${pct}%`;
                        if(progressText) progressText.textContent = `${pct}%`;
                    }
                }
            });
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            
            let fullText = "";
            if (Array.isArray(input)) {
                for (let i = 0; i < input.length; i++) {
                    if(statusTitle) statusTitle.textContent = `Scanning Page ${i+1} of ${input.length}...`;
                    const { data } = await worker.recognize(input[i]);
                    fullText += data.text + "\n";
                }
            } else {
                const { data } = await worker.recognize(input);
                fullText = data.text;
            }
            
            await worker.terminate();
            
            // Extraction Phase
            parseIntelligentData(fullText);
            
            // Build Review Table
            buildReviewTable();
            showStep(3);

        } catch (error) {
            console.error("OCR Error", error);
            alert("OCR Scanning failed. The file might be corrupted or unsupported.");
            showStep(1);
        }
    }

    function parseIntelligentData(rawText) {
        extractedDataModel = {};
        
        console.log("Raw OCR Text:", rawText);

        // Aadhaar ID: 12 digits (often divided by spaces)
        const aadhaarMatch = rawText.match(/\b\d{4}\s\d{4}\s\d{4}\b/) || rawText.match(/\b\d{12}\b/);
        if (aadhaarMatch) extractedDataModel.aadhaarId = aadhaarMatch[0].replace(/\s/g, '');
        
        // PAN ID: 5 letters, 4 digits, 1 letter
        const panMatch = rawText.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/i);
        if (panMatch) extractedDataModel.panId = panMatch[0].toUpperCase();

        // Date of Birth: various formats
        const dobMatch = rawText.match(/\b(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})\b/) || 
                         rawText.match(/(?:DOB|Birth)[\s:]*(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/i);
        if (dobMatch) {
            extractedDataModel.dob = `${dobMatch[3]}-${dobMatch[2]}-${dobMatch[1]}`;
        }
        
        // Names: Usually follow labels like "Name"
        const nameMatch = rawText.match(/(?:Name|NAME|Full Name)[\s:]*([A-Za-z\s]+)(?:DOB|Date|Birth|Father)/i);
        if (nameMatch && nameMatch[1]) {
            const nameParts = nameMatch[1].trim().split(/\s+/);
            if (nameParts.length >= 2) {
                extractedDataModel.firstName = nameParts[0];
                extractedDataModel.lastName = nameParts[nameParts.length - 1];
            } else if (nameParts.length === 1) {
                extractedDataModel.firstName = nameParts[0];
            }
        }

        // Sanitize and trim
        for (const k in extractedDataModel) {
            if (typeof extractedDataModel[k] === 'string') {
                extractedDataModel[k] = extractedDataModel[k].trim().replace(/[<>]/g, "");
            }
        }
    }

    function buildReviewTable() {
        if(!resultsBody) return;
        resultsBody.innerHTML = '';
        const fieldMeta = {
            'firstName': 'First Name',
            'lastName': 'Last Name',
            'dob': 'Date of Birth',
            'aadhaarId': 'Aadhar ID',
            'panId': 'PAN ID'
        };

        const keys = Object.keys(extractedDataModel);
        if (keys.length === 0) {
            resultsBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 text-xs italic cursor-default">No structured data recognized. The document will be uploaded securely without auto-fill.</td></tr>`;
            return;
        }

        keys.forEach(key => {
            const extractVal = extractedDataModel[key];
            const existingVal = currentProfileData[key] || '';
            const fieldName = fieldMeta[key] || key;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ocr-field-row";
            tr.dataset.key = key;
            tr.dataset.extract = extractVal;
            
            let statusBadge = '';
            let actionHtml = '';
            let existingDisplay = existingVal ? existingVal : `<span class="italic text-slate-400">Empty</span>`;
            
            let displayExtractVal = extractVal;
            if (key === 'aadhaarId' && extractVal.length > 8) displayExtractVal = 'XXXX-XXXX-' + extractVal.slice(-4);
            if (key === 'panId' && extractVal.length > 4) displayExtractVal = 'XXXXX' + extractVal.slice(5);
            
            let displayExistingVal = existingDisplay;
            if (existingVal && key === 'aadhaarId' && existingVal.length > 8) displayExistingVal = 'XXXX-XXXX-' + existingVal.slice(-4);
            if (existingVal && key === 'panId' && existingVal.length > 4) displayExistingVal = 'XXXXX' + existingVal.slice(5);

            if (!existingVal) {
                statusBadge = `<span class="text-[9px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md uppercase font-bold ml-2">Auto-fill</span>`;
                actionHtml = `<span class="text-xs font-medium text-slate-400">Will be applied</span>`;
            } else if (existingVal === extractVal) {
                statusBadge = `<span class="text-[9px] px-2 py-0.5 bg-green-100 text-green-700 rounded-md uppercase font-bold ml-2">Verified ✓</span>`;
                actionHtml = `<span class="text-xs font-medium text-slate-400">Matches perfectly</span>`;
            } else {
                statusBadge = `<span class="text-[9px] px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-md uppercase font-bold ml-2">Mismatch!</span>`;
                actionHtml = `
                    <div class="flex items-center gap-2">
                        <label class="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" name="conflict_${key}" value="existing" class="text-primary focus:ring-primary w-3 h-3" checked> Keep Exisiting
                        </label>
                        <label class="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="radio" name="conflict_${key}" value="extract" class="text-yellow-600 focus:ring-yellow-600 w-3 h-3"> Use Extracted
                        </label>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td class="p-4 font-bold text-slate-800 dark:text-slate-200">
                    ${fieldName} ${statusBadge}
                </td>
                <td class="p-4 font-mono text-slate-600 dark:text-slate-300 font-medium">${displayExtractVal}</td>
                <td class="p-4 font-mono text-slate-600 dark:text-slate-300 border-l border-slate-100 dark:border-slate-700/50">${displayExistingVal}</td>
                <td class="p-4 border-l border-slate-100 dark:border-slate-700/50">
                    ${actionHtml}
                </td>
            `;
            resultsBody.appendChild(tr);
        });
    }
});
