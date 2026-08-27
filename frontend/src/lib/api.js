import { supabase } from './supabase';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:4000/api';

export async function api(
  path,
  options = {},
) {
  const { data, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      sessionError.message ||
        'Unable to read the authentication session.',
    );
  }

  const token =
    data.session?.access_token;

  if (!token) {
    throw new Error(
      'Your session has expired. Please sign in again.',
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_URL}${path}`,
      {
        ...options,

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${token}`,

          ...(options.headers || {}),
        },
      },
    );
  } catch (error) {
    throw new Error(
      `Unable to connect to the PinkLedger backend at ${API_URL}. Make sure the backend is running.`,
    );
  }

  const rawText =
    await response.text();

  let payload = null;

  if (rawText) {
    try {
      payload =
        JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    let message =
      payload?.error ||
      payload?.message ||
      rawText ||
      `Request failed with status ${response.status}`;

    if (
      response.status === 429 &&
      !payload?.error &&
      !payload?.message
    ) {
      message =
        'Too many requests were sent to the backend. Please wait briefly and try again.';
    }

    const error =
      new Error(message);

    error.status =
      response.status;

    throw error;
  }

  if (
    response.status === 204 ||
    !rawText
  ) {
    return null;
  }

  return payload;
}