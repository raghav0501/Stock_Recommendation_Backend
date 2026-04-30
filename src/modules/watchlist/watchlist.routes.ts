import { Router } from 'express';
import * as watchlistController from './watchlist.controller';
import { authenticate, loadEntitlements } from '../../middleware/auth';

const router = Router();

router.use(authenticate, loadEntitlements);

router.get('/',          watchlistController.getWatchlist);
router.post('/',         watchlistController.addSymbol);
router.delete('/:symbol', watchlistController.removeSymbol);

export default router;
