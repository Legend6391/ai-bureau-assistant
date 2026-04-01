import { supabase } from "./supabaseConfig.js";

let provisioningPromise = null;

/**
 * Ensures a user has a dedicated Supabase Storage bucket.
 * If not, creates one and stores the mapping in the 'users' table.
 * @param {string} userId - Firebase UID
 * @param {string} email - Optional user email
 * @returns {Promise<string>} - The unique bucket_id
 */
export const ensureUserBucket = async (userId, email = null) => {
    if (!userId) throw new Error("User ID is required to provision storage.");

    // Simple idempotency guard to prevent concurrent calls from multiple modules
    if (provisioningPromise) return provisioningPromise;

    provisioningPromise = (async () => {
        try {
            // 1. Check if user already has a bucket_id in our 'users' table
            const { data: userRecord, error: fetchError } = await supabase
                .from('users')
                .select('bucket_id')
                .eq('id', userId)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (userRecord && userRecord.bucket_id) {
                // User already has a bucket.
                return userRecord.bucket_id;
            }

            // 2. Generate a unique bucket ID (UUID based)
            const bucketId = `user-vault-${crypto.randomUUID()}`;

            // 3. Create the bucket in Supabase Storage
            const { error: bucketError } = await supabase.storage.createBucket(bucketId, {
                public: true, 
                allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
                fileSizeLimit: 5242880 // 5MB
            });

            if (bucketError) {
                // If it already exists (e.g. from a previous failed registration step), try to recover
                if (bucketError.message.includes('already exists')) {
                    console.warn("Bucket already exists in storage but was missing from users table. Recovering...");
                } else {
                    console.error("Bucket creation failed:", bucketError);
                    throw new Error(`Failed to provision secure storage: ${bucketError.message}`);
                }
            }

            // 4. Store the mapping in the 'users' table
            const { error: insertError } = await supabase
                .from('users')
                .upsert({
                    id: userId,
                    email: email,
                    bucket_id: bucketId
                });

            if (insertError) throw insertError;

            return bucketId;
        } catch (error) {
            console.error("Error in ensureUserBucket:", error);
            throw error;
        } finally {
            provisioningPromise = null;
        }
    })();

    return provisioningPromise;
};

/**
 * Uploads a document to the user's specific bucket.
 * @param {File} file 
 * @param {string} bucketId 
 * @returns {Promise<{fileName: string, downloadURL: string}>}
 */
export const uploadDocument = async (file, bucketId) => {
    if (!file || !bucketId) throw new Error("File or bucketId missing");

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
    const filePath = uniqueFileName; 

    const { data, error } = await supabase.storage
        .from(bucketId)
        .upload(filePath, file);

    if (error) {
        console.error("Supabase Storage error:", error);
        throw new Error(`Failed to upload document: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
        .from(bucketId)
        .getPublicUrl(filePath);

    return { 
        fileName: uniqueFileName, 
        downloadURL: publicUrlData.publicUrl 
    };
};
