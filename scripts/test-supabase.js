import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wvetfxilqqjxdknebwli.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZXRmeGlscXFqeGRrbmVid2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODg1NTMsImV4cCI6MjA4NzU2NDU1M30.ghsAy7_u4b9R2MjENftU9JHlQtZnGU9QIn7QV1fauuI";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const { data, error } = await supabase
    .from("users")
    .insert({
      openId: "test-user-id",
      name: "Test User",
      email: "test@example.com",
      image: "",
    })
    .select("id")
    .single();

  if (error) {
    console.error("INSERT ERROR:");
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log("INSERT SUCCESS:", data);
  }
}

testInsert();
