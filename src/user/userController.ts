import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import userModel from "./userModel";
import bcrypt from "bcrypt";
import { sign } from "jsonwebtoken";
import { config } from "../config/config";
import { User } from "./userTypes";
const createUser = async (req: Request, res: Response, next: NextFunction) => {
   const { name, email, password } = req.body;

   // Validation
   if (!name || !email || !password) {
      const error = createHttpError(400, "All fields are required");
      return next(error);
   }

   // Database Call

   try {
      const user = await userModel.findOne({ email });

      if (user) {
         const error = createHttpError(400, "User already exists");
         return next(error);
      }
   } catch (error) {
      const err = createHttpError(500, "Database error while register");
      return next(err);
   }

   // Process
   const hashedPassword = await bcrypt.hash(password, 10);
   let newUser: User;
   try {
      newUser = await userModel.create({
         name,
         email,
         password: hashedPassword,
      });
   } catch (error) {
      const err = createHttpError(500, "error while creating user");
      return next(err);
   }

   try {
      // Token Generation
      const token = sign(
         {
            sub: newUser._id,
         },
         config.jwtSecret as string,
         {
            expiresIn: "7d",
         }
      );

      // Response
      res.json({
         accessToken: token,
      });
   } catch (error) {
      const err = createHttpError(500, "error while signing jwt token");
      return next(err);
   }
};

export { createUser };
