import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://wvetfxilqqjxdknebwli.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZXRmeGlscXFqeGRrbmVid2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODg1NTMsImV4cCI6MjA4NzU2NDU1M30.ghsAy7_u4b9R2MjENftU9JHlQtZnGU9QIn7QV1fauuI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});