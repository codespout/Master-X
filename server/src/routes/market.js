import { Router } from 'express';
import { getPrices } from '../priceEngine.js';
import { PAIRS } from '../config.js';
import { ok } from '../utils.js';

const router = Router();

router.get('/prices', (req, res) => ok(res, getPrices()));

router.get('/pairs', (req, res) =>
  ok(res, PAIRS.map((p) => ({ symbol: p.symbol, base: p.base, quote: p.quote, precision: p.precision })))
);

export default router;
