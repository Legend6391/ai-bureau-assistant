import { supabase } from "./supabaseConfig.js";

export const uploadDocument = async (file, userId) => {
    if (!file || !userId) throw new Error("File or userId missing");

    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type.");
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
        throw new Error("File too large. Maximum size is 5MB.");
    }

    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const uniqueFileName = `${timestamp}_${cleanFileName}`;
    const filePath = `${userId}/${uniqueFileName}`;

    const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

    if (error) {
        console.error("Supabase Storage error:", error);
        throw new Error(`Failed to upload document: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

    return { 
        fileName: uniqueFileName, 
        downloadURL: publicUrlData.publicUrl 
    };
};
