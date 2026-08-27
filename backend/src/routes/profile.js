import { Router } from 'express';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('profiles')
      .select('id,email,full_name,currency,created_at')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const payload = {
      full_name: String(req.body.full_name || '').trim().slice(0, 100),
      currency: String(req.body.currency || 'IDR').trim().slice(0, 3).toUpperCase(),
    };
    const { data, error } = await req.supabase
      .from('profiles')
      .update(payload)
      .eq('id', req.user.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
