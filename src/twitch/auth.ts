export type TwitchIdentity = {
  token: string;
  clientId: string;
  userId: string;
  login: string;
  expiresAt: number;
};
const KEY = "fw.twitch.session";
const STATE = "fw.twitch.state";
export function configuredClientId() {
  return (
    import.meta.env.VITE_TWITCH_CLIENT_ID ||
    localStorage.getItem("fw.twitch.clientId") ||
    ""
  );
}
export function startAuthorization(clientId: string) {
  if (!/^[a-zA-Z0-9]{10,64}$/.test(clientId))
    throw new Error("Enter a valid Twitch application Client ID.");
  localStorage.setItem("fw.twitch.clientId", clientId);
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE, state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${location.origin}/`,
    response_type: "token",
    scope: "user:read:chat",
    state,
  });
  location.assign(`https://id.twitch.tv/oauth2/authorize?${params}`);
}
export async function validateToken(
  token: string,
  expectedClientId: string,
): Promise<TwitchIdentity> {
  const response = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      "Your Twitch connection expired. Connect again to continue.",
    );
  const data = await response.json();
  if (
    data.client_id !== expectedClientId ||
    !data.user_id ||
    !data.scopes?.includes("user:read:chat")
  )
    throw new Error(
      "Twitch did not grant chat access to this application. Please connect again.",
    );
  return {
    token,
    clientId: data.client_id,
    userId: data.user_id,
    login: data.login,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
export async function restoreAuthorization(): Promise<TwitchIdentity | null> {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  if (query.has("error")) {
    history.replaceState(null, "", location.pathname);
    sessionStorage.removeItem(STATE);
    throw new Error(
      "Twitch authorization was cancelled. Rehearsal mode is still available.",
    );
  }
  if (fragment.has("access_token")) {
    history.replaceState(null, "", location.pathname + location.search);
    const state = sessionStorage.getItem(STATE);
    sessionStorage.removeItem(STATE);
    if (!state || fragment.get("state") !== state)
      throw new Error(
        "Twitch sign-in could not be verified. Please connect again.",
      );
    const identity = await validateToken(
      fragment.get("access_token")!,
      configuredClientId(),
    );
    sessionStorage.setItem(KEY, JSON.stringify(identity));
    return identity;
  }
  const saved = sessionStorage.getItem(KEY);
  if (!saved) return null;
  try {
    const identity = JSON.parse(saved) as TwitchIdentity;
    const valid = await validateToken(identity.token, configuredClientId());
    sessionStorage.setItem(KEY, JSON.stringify(valid));
    return valid;
  } catch (error) {
    sessionStorage.removeItem(KEY);
    throw error;
  }
}
export function clearAuthorization() {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(STATE);
}
