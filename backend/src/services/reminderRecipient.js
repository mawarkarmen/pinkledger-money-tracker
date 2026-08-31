import {
  adminSupabase,
} from '../supabase.js';


function cleanText(value) {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value.trim();
}


export async function resolveReminderRecipient({
  userId,
  profileClient = adminSupabase,
  authUser = null,
}) {
  if (!userId) {
    throw new Error(
      'A user ID is required to resolve a reminder recipient.',
    );
  }


  /*
   * First try the profile table.
   *
   * maybeSingle() is important here.
   *
   * If the profile row does not exist,
   * we still want to fall back to the
   * Supabase Auth user.
   */
  const {
    data: profile,
    error: profileError,
  } =
    await profileClient
      .from(
        'profiles',
      )
      .select(
        'email, full_name',
      )
      .eq(
        'id',
        userId,
      )
      .maybeSingle();


  if (profileError) {
    throw profileError;
  }


  /*
   * The Test Reminder endpoint already
   * has req.user available.
   *
   * The scheduler does not.
   *
   * Therefore authUser can optionally
   * be supplied by the request route.
   */
  let resolvedAuthUser =
    authUser?.id ===
    userId
      ? authUser
      : null;


  const profileEmail =
    cleanText(
      profile?.email,
    );


  const profileName =
    cleanText(
      profile?.full_name,
    );


  /*
   * If profile data is incomplete,
   * retrieve the user directly from
   * Supabase Auth.
   *
   * This is particularly important for
   * scheduled reminders because there
   * is no req.user available there.
   */
  if (
    !resolvedAuthUser &&
    (
      !profileEmail ||
      !profileName
    )
  ) {
    const {
      data: authData,
      error: authError,
    } =
      await adminSupabase
        .auth
        .admin
        .getUserById(
          userId,
        );


    if (authError) {
      throw authError;
    }


    resolvedAuthUser =
      authData?.user ||
      null;
  }


  const authEmail =
    cleanText(
      resolvedAuthUser
        ?.email,
    );


  /*
   * Support several common metadata
   * formats.
   */
  const authName =
    cleanText(
      resolvedAuthUser
        ?.user_metadata
        ?.full_name,
    ) ||
    cleanText(
      resolvedAuthUser
        ?.user_metadata
        ?.name,
    );


  /*
   * Recipient priority:
   *
   * 1. Profile email
   * 2. Supabase Auth email
   */
  const email =
    profileEmail ||
    authEmail ||
    null;


  /*
   * Name priority:
   *
   * 1. Profile full_name
   * 2. Supabase Auth metadata
   * 3. Generic greeting
   */
  const name =
    profileName ||
    authName ||
    'there';


  return {
    email,

    name,

    /*
     * Useful for logs and debugging.
     */
    emailSource:
      profileEmail
        ? 'profile'
        : authEmail
          ? 'auth'
          : 'none',
  };
}