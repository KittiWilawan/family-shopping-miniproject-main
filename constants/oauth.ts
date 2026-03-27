import * as Linking from "expo-linking";
import * as ReactNative from "react-native";
import { supabase } from "@/services/supabase";

const bundleId = "space.manus.family.shopping.t20260327112657";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const API_BASE_URL = env.apiBaseUrl;

export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

export const getRedirectUri = () => {
  return Linking.createURL("/oauth/callback", {
    scheme: env.deepLinkScheme,
  });
};

/**
 * Start Google OAuth login via Supabase Auth
 */
export async function startOAuthLogin(): Promise<string | null> {
  const redirectTo = getRedirectUri();

  if (ReactNative.Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
    return null;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No OAuth URL returned from Supabase");

  const supported = await Linking.canOpenURL(data.url);
  if (!supported) throw new Error("Cannot open OAuth URL");

  await Linking.openURL(data.url);
  return null;
}
