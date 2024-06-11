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
      res.status(201).json({
         accessToken: token,
      });
   } catch (error) {
      const err = createHttpError(500, "error while signing jwt token");
      return next(err);
   }
};

const loginUser = async (req: Request, res: Response, next: NextFunction) => {
   const { email, password } = req.body;
   if (!email || !password) {
      return next(createHttpError(400, "All credentials required!"));
   }
   let user;
   try {
      user = await userModel.findOne({ email });

      if (!user) {
         return next(createHttpError(404, "User not found!"));
      }
   } catch (error) {
      return next(
         createHttpError(
            500,
            "something went wrong while fetching user in login!"
         )
      );
   }

   try {
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
         return next(createHttpError(400, "Username or Password incorrect!"));
      }

      // create access token for login

      const token = sign({ sub: user._id }, config.jwtSecret as string, {
         expiresIn: "7d",
      });

      res.json({
         accessToken: token,
      });
   } catch (error) {
      return next(
         createHttpError(
            500,
            "Something went wrong while matching password or generating token!"
         )
      );
   }
};

export { createUser, loginUser };
