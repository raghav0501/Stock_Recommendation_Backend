import { Router } from 'express';
import * as preferencesController from './preferences.controller';
import { authenticate, loadEntitlements } from '../../middleware/auth';

const router = Router();

router.use(authenticate, loadEntitlements);

router.get('/',  preferencesController.getPreferences);
router.put('/',  preferencesController.updatePreferences);

export default router;
