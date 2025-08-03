import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { createChatroom, getChatroom, listChatrooms, sendMessage } from '../controllers/chatroom.controller.js';
const router = Router();

router.use(protect);

router.route('/')
  .post(createChatroom)
  .get(listChatrooms);

router.route('/:id')
  .get(getChatroom);

router.route('/:id/message')
  .post(sendMessage);

export default router;