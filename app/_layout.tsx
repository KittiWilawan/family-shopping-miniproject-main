import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { useAuth } from "@/hooks/use-auth";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "@/services/supabase";

SplashScreen.preventAutoHideAsync();

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [hasFamily, setHasFamily] = useState<boolean | null>(null);
  const [checkingFamily, setCheckingFamily] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasFamily(null);
      return;
    }
    
    // Check if user has a family
    const checkFamily = async () => {
      setCheckingFamily(true);
      try {
        // Find user by openId (auth.uid() is usually the openId in our schema if they were created correctly, 
        // but let's query users table first to get the internal id, then check familyMembers)
        // Wait, the user object from useAuth is the Supabase auth.user. Its id is user.id.
        // Let's assume the schema maps auth.users to public.users or we check public.users by openId
        const { data: dbUser } = await supabase
          .from("users")
          .select("id")
          .eq("openId", user.id)
          .maybeSingle();

        if (dbUser) {
          const { data: member } = await supabase
            .from("familyMembers")
            .select("id")
            .eq("userId", dbUser.id)
            .limit(1)
            .maybeSingle();
            
          setHasFamily(!!member);
        } else {
          // Sync user to public.users table if not exists
          const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert({
              openId: user.id,
              name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "ผู้ใช้",
              email: user.email || "",
            })
            .select("id")
            .single();

          if (!insertError && newUser) {
            setHasFamily(false);
          } else {
            console.error("Failed to sync user to public.users", insertError);
            setHasFamily(false); 
          }
        }
      } catch (e) {
        console.error("Error checking family", e);
        setHasFamily(false);
      } finally {
        setCheckingFamily(false);
      }
    };
    
    checkFamily();
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (user && checkingFamily) return;

    const inAuthGroup = segments[0] === "login" || (segments as string[])[0] === "family-setup";
    const inOAuthGroup = segments[0] === "oauth";

    if (inOAuthGroup) return;

    if (!user) {
      if (!inAuthGroup) {
        router.replace("/login");
      }
      return;
    }

    // User is logged in and we know family status
    if (hasFamily !== null && !checkingFamily) {
      if (hasFamily) {
        if (inAuthGroup) {
          router.replace("/(tabs)");
        }
      } else {
        if ((segments as string[])[0] !== "family-setup") {
          router.replace("/family-setup" as any);
        }
      }
    }
  }, [user, loading, hasFamily, checkingFamily, segments]);

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  return <>{children}</>;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    // Web safe area override
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="family-setup" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
        </AuthGuard>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
