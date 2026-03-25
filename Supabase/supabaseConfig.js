import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Replace these with your actual Supabase URL and Anon Key found in the Project Settings -> API
const supabaseUrl = "https://xirpynrdafqrsrbfcfyh.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpcnB5bnJkYWZxcnNyYmZjZnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4OTE5MjcsImV4cCI6MjA4OTQ2NzkyN30.xuJlANpD7wC-9FxCPQ_Po0XtNE2AqehT3UQEPODVbzI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
