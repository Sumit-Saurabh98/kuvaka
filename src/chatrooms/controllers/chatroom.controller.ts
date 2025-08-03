import { Request, Response, NextFunction } from "express";
import { ChatroomService } from "../services/chatroom.service.js";
import { catchAsync, AppError } from "../../utils/errorHandler.js";

const chatroomService = new ChatroomService();

export const createChatroom = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name } = req.body;
    const userId = req.user?.id;

    console.log("name", name, userId)

    if (!userId) {
      return next(new AppError("User not authenticated.", 401));
    }
    if (!name) {
      return res
        .status(400)
        .json({ status: "fail", message: "Chatroom name is required." });
    }

    const chatroom = await chatroomService.createChatroom(userId, name);

    res.status(201).json({
      status: "success",
      message: "Chatroom created successfully.",
      data: {
        chatroom,
      },
    });
  }
);

export const listChatrooms = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return next(new AppError("User not authenticated.", 401));
    }

    const chatrooms = await chatroomService.listChatrooms(userId);

    res.status(200).json({
      status: "success",
      results: chatrooms.length,
      data: {
        chatrooms,
      },
    });
  }
);

export const getChatroom = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return next(new AppError("User not authenticated.", 401));
    }

    const chatroom = await chatroomService.getChatroomDetails(id, userId);

    res.status(200).json({
      status: "success",
      data: {
        chatroom,
      },
    });
  }
);

export const sendMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id: chatroomId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return next(new AppError("User not authenticated.", 401));
    }
    if (!content) {
      return res
        .status(400)
        .json({ status: "fail", message: "Message content is required." });
    }

    const message = await chatroomService.sendMessage(
      chatroomId,
      userId,
      content
    );

    res.status(201).json({
      status: "success",
      message: "Message sent and queued for AI response.",
      data: {
        message,
      },
    });
  }
);
