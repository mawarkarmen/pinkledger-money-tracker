import { adminSupabase, createUserSupabase } from '../supabase.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { data, error } = await adminSupabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    req.user = data.user;
    req.accessToken = token;
    req.supabase = createUserSupabase(token);
    next();
  } catch (error) {
    next(error);
  }
}
