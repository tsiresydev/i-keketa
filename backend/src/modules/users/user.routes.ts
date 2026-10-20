import { Router } from 'express';
import { getCurrentUserController } from './user.controller';
import { authenticate } from '../../middleware/authenticate';

export const userRouter = Router();

userRouter.get('/me', authenticate, getCurrentUserController);
