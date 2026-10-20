import { Router } from 'express';
import {
  deletePhotoController,
  getCurrentUserController,
  listUsersController,
  updateProfileController,
  uploadPhotoController,
} from './user.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { photoUpload, toUploadApiError } from '../../middleware/upload';
import { profileUpdateSchema, userSearchSchema } from '../../schemas/user.schema';

export const userRouter = Router();

userRouter.get('/me', authenticate, getCurrentUserController);

userRouter.put(
  '/me',
  authenticate,
  validate({ body: profileUpdateSchema }),
  updateProfileController,
);

userRouter.post(
  '/me/photo',
  authenticate,
  (req, res, next) => {
    photoUpload(req, res, (error: unknown) => {
      if (error) {
        next(toUploadApiError(error));
        return;
      }

      next();
    });
  },
  uploadPhotoController,
);

userRouter.delete('/me/photo', authenticate, deletePhotoController);

userRouter.get('/', authenticate, validate({ query: userSearchSchema }), listUsersController);
