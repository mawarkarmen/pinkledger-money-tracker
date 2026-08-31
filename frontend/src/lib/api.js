import {
  supabase,
} from './supabase';


const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:4000/api';


function getBrowserTimeZone() {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      'UTC'
    );

  } catch {
    return 'UTC';
  }
}


async function request(
  path,
  options = {},
) {
  const {
    data,
    error:
      sessionError,
  } =
    await supabase
      .auth
      .getSession();


  if (
    sessionError
  ) {
    throw new Error(
      sessionError.message ||
        'Unable to read the authentication session.',
    );
  }


  const token =
    data.session
      ?.access_token;


  if (!token) {
    throw new Error(
      'Your session has expired. Please sign in again.',
    );
  }


  const timeZone =
    getBrowserTimeZone();


  let response;


  try {
    response =
      await fetch(
        `${API_URL}${path}`,
        {
          ...options,

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`,

            'X-Timezone':
              timeZone,

            ...(options.headers || {}),
          },
        },
      );

  } catch {
    throw new Error(
      `Unable to connect to the PinkLedger backend at ${API_URL}. Make sure the backend is running.`,
    );
  }


  const rawText =
    await response.text();


  let payload =
    null;


  if (rawText) {
    try {
      payload =
        JSON.parse(
          rawText,
        );

    } catch {
      payload =
        null;
    }
  }


  if (
    !response.ok
  ) {
    let message =
      payload?.error ||
      payload?.message ||
      rawText ||
      `Request failed with status ${response.status}`;


    if (
      response.status ===
        429 &&
      !payload?.error &&
      !payload?.message
    ) {
      message =
        'Too many requests were sent to the backend. Please wait briefly and try again.';
    }


    const error =
      new Error(
        message,
      );


    error.status =
      response.status;


    throw error;
  }


  /*
   * Read optional transaction
   * pagination headers.
   */
  const pagination = {
    page:
      Number(
        response.headers.get(
          'X-Page',
        ),
      ) ||
      null,

    pageSize:
      Number(
        response.headers.get(
          'X-Page-Size',
        ),
      ) ||
      null,

    totalCount:
      Number(
        response.headers.get(
          'X-Total-Count',
        ),
      ) ||
      null,

    totalPages:
      Number(
        response.headers.get(
          'X-Total-Pages',
        ),
      ) ||
      null,
  };


  return {
    data:
      response.status ===
        204 ||
      !rawText
        ? null
        : payload,

    pagination,
  };
}


/*
 * Existing helper.
 *
 * Existing PinkLedger pages continue
 * working without modification.
 */
export async function api(
  path,
  options = {},
) {
  const result =
    await request(
      path,
      options,
    );


  return result.data;
}


/*
 * Pagination-aware helper.
 *
 * Example:
 *
 * const {
 *   data,
 *   pagination,
 * } = await apiWithMeta(
 *   '/transactions?page=1&page_size=50'
 * );
 */
export async function apiWithMeta(
  path,
  options = {},
) {
  return request(
    path,
    options,
  );
}