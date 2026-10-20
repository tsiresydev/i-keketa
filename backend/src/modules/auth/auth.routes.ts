import { Router } from 'express';
import { loginController, registerController } from './auth.controller';
import { loginSchema, registerSchema } from '../../schemas/auth.schema';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rate-limiters';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), registerController);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), loginController);
