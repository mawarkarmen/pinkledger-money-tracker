import 'dotenv/config';


const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];


for (
  const key of
  required
) {
  if (
    !process.env[key]
  ) {
    throw new Error(
      `Missing required environment variable: ${key}`,
    );
  }
}


export const config = {

  /*
   * ========================================================
   * APPLICATION
   * ========================================================
   */
  nodeEnv:
    process.env.NODE_ENV ||
    'development',


  port:
    Number(
      process.env.PORT ||
        4000,
    ),


  frontendUrl:
    process.env.FRONTEND_URL ||
    'http://localhost:5173',


  /*
   * ========================================================
   * SUPABASE
   * ========================================================
   */
  supabaseUrl:
    process.env.SUPABASE_URL,


  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY,


  supabaseServiceRoleKey:
    process.env
      .SUPABASE_SERVICE_ROLE_KEY,


  /*
   * ========================================================
   * API
   * ========================================================
   */
  rateLimitMax:
    Number(
      process.env
        .RATE_LIMIT_MAX ||
        300,
    ),


  /*
   * ========================================================
   * EMAIL
   * ========================================================
   */
  smtp: {
    host:
      process.env.SMTP_HOST,


    port:
      Number(
        process.env.SMTP_PORT ||
          587,
      ),


    secure:
      String(
        process.env.SMTP_SECURE ||
          'false',
      ).toLowerCase() ===
      'true',


    user:
      process.env.SMTP_USER,


    pass:
      process.env.SMTP_PASS,


    from:
      process.env.EMAIL_FROM ||
      process.env.SMTP_USER ||
      '',
  },
};