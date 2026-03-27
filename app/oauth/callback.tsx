import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/services/supabase";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        let callbackUrl = await Linking.getInitialURL();
        if (!callbackUrl && typeof window !== "undefined") {
          callbackUrl = window.location.href;
        }
        if (!callbackUrl) {
          throw new Error("Missing callback URL");
        }

        const fullUrl = new URL(callbackUrl, "http://localhost");
        const hashParams = new URLSearchParams(fullUrl.hash.replace(/^#/, ""));
        const queryParams = fullUrl.searchParams;

        // Check for errors first
        const err = hashParams.get("error_description") || hashParams.get("error");
        if (err) throw new Error(err);

        // Handle PKCE code exchange
        const code = queryParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(callbackUrl);
          if (error) throw error;
        } else {
          // Handle implicit flow (access_token in hash)
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken ?? "",
            });
            if (error) throw error;
          } else {
            throw new Error("No access token received from Google login");
          }
        }

        setStatus("success");
        setTimeout(() => {
          router.replace("/(tabs)");
        }, 700);
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to complete authentication",
        );
      }
    };

    handleCallback();
  }, [router]);

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ThemedView className="flex-1 items-center justify-center gap-4 p-5">
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base leading-6 text-center text-foreground">
              กำลังเข้าสู่ระบบ...
            </Text>
          </>
        )}
        {status === "success" && (
          <>
            <Text className="text-base leading-6 text-center text-foreground">
              เข้าสู่ระบบสำเร็จ!
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              กำลังพาไปหน้าหลัก...
            </Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text className="mb-2 text-xl font-bold leading-7 text-error">
              เข้าสู่ระบบล้มเหลว
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              {errorMessage}
            </Text>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}
