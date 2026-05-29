// Pulse Client Network Service with Authentication Attachments
const BASE_URL = ''; // Default router to same hostname / server proxy routing

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const token = localStorage.getItem('pulse_token');
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let finalBody: any = options.body;

  // If payload is standard object, configure Content-Type to JSON automatically
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    finalBody = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      body: finalBody,
      headers,
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.mov') ||
    url.startsWith('data:video/')
  );
}
