import { Router } from 'express';
import { categorySchema, categoryUpdateSchema } from '../utils/validation.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('categories')
      .select('*')
      .order('type')
      .order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const { data, error } = await req.supabase
      .from('categories')
      .insert({ ...input, user_id: req.user.id })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const payload = categoryUpdateSchema.parse(req.body);

    const { data, error } = await req.supabase
      .from('categories')
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
