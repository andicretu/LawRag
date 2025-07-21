"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

    const handleRedirectCallback = (appState?: { returnTo?: string }) => {
    router.push(appState?.returnTo || "/ask");
    };

    const redirectUri = typeof window !== "undefined"
    ? `${window.location.origin}/ask`
    : "";
    console.log("🔁 Calculated redirect_uri:", redirectUri);


  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: typeof window !== "undefined" ? `${window.location.origin}/ask` : "",
        audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
        scope: "openid profile email",
      }}
      
      onRedirectCallback={handleRedirectCallback}

    >
      {children}
    </Auth0Provider>
  );
}
