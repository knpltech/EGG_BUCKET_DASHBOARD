const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const getRequestUrl = (input) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url || "";
};

const isApiRequest = (input) => {
  try {
    const requestUrl = new URL(getRequestUrl(input), window.location.origin);
    const apiUrl = new URL(API_BASE_URL, window.location.origin);
    return requestUrl.origin === apiUrl.origin
      && (requestUrl.pathname === apiUrl.pathname || requestUrl.pathname.startsWith(`${apiUrl.pathname.replace(/\/$/, "")}/`));
  } catch {
    return false;
  }
};

export const installAuthenticatedFetch = () => {
  if (window.__eggbucketAuthenticatedFetchInstalled) return;
  window.__eggbucketAuthenticatedFetchInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const token = localStorage.getItem("token");
    if (!token || !isApiRequest(input)) return nativeFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    return nativeFetch(input, { ...init, headers });
  };
};
