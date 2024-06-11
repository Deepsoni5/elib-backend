import { NextFunction, Request, Response } from "express";
import cloudinary from "../config/cloudinary";
import path from "path";
import createHttpError from "http-errors";
import bookModel from "./bookModel";
import fs from "fs";
import { AuthRequest } from "../middlewares/authenticate";

const createBook = async (req: Request, res: Response, next: NextFunction) => {
   const { title, genre } = req.body;

   const files = req.files as { [fieldname: string]: Express.Multer.File[] };
   const coverImageMimeType = files.coverImage[0].mimetype.split("/").at(-1);
   const fileName = files.coverImage[0].filename;
   const filePath = path.resolve(
      __dirname,
      "../../public/data/uploads",
      fileName
   );

   const bookFileName = files.file[0].filename;
   const bookFilePath = path.resolve(
      __dirname,
      "../../public/data/uploads",
      bookFileName
   );

   try {
      const uploadResult = await cloudinary.uploader.upload(filePath, {
         filename_override: fileName,
         folder: "book-covers",
         format: coverImageMimeType,
      });

      const bookFileUploadResult = await cloudinary.uploader.upload(
         bookFilePath,
         {
            resource_type: "raw",
            filename_override: bookFileName,
            folder: "book-pdfs",
            format: "pdf",
         }
      );

      const _req = req as AuthRequest;

      const newBook = await bookModel.create({
         title,
         genre,
         author: _req.userId,
         coverImage: uploadResult.secure_url,
         file: bookFileUploadResult.secure_url,
      });

      // Delete Temp files
      try {
         await fs.promises.unlink(filePath);
         await fs.promises.unlink(bookFilePath);
      } catch (error) {
         console.log(error);
         return next(createHttpError(500, "Error while Deleting temp files"));
      }

      res.status(201).json({ id: newBook._id });
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while uploading book pdf"));
   }
};

const updateBook = async (req: Request, res: Response, next: NextFunction) => {
   const { title, genre } = req.body;

   const bookId = req.params.bookId;
   let book;
   try {
      book = await bookModel.findOne({ _id: bookId });
      if (!book) {
         return next(createHttpError(404, "Book Not Found!"));
      }
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while fetching Book!"));
   }

   try {
      const _req = req as AuthRequest;
      if (book.author.toString() !== _req.userId) {
         return next(createHttpError(403, "You can not update Others Book!"));
      }
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while fetching Book!"));
   }

   const files = req.files as { [fieldname: string]: Express.Multer.File[] };

   let completeCoverImage = "";

   try {
      if (files.coverImage) {
         const filename = files.coverImage[0].filename;
         const coverMimeType = files.coverImage[0].mimetype.split("/").at(-1);

         // send files to cloudinary

         const filepath = path.resolve(
            __dirname,
            "../../public/data/uploads/" + filename
         );

         completeCoverImage = filename;
         const uploadResult = await cloudinary.uploader.upload(filepath, {
            filename_override: completeCoverImage,
            folder: "book-covers",
            format: coverMimeType,
         });

         completeCoverImage = uploadResult.secure_url;
         try {
            await fs.promises.unlink(filepath);
         } catch (error) {
            console.log(error);
            return next(
               createHttpError(400, "Error while deleting cover image")
            );
         }
      }
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while uploading coverimage"));
   }

   let completeFileName = "";
   try {
      if (files.file) {
         const bookFilePath = path.resolve(
            __dirname,
            "../../public/data/uploads/" + files.file[0].filename
         );

         const bookFileName = files.file[0].filename;
         completeFileName = bookFileName;

         const uploadResultPdf = await cloudinary.uploader.upload(
            bookFilePath,
            {
               resource_type: "raw",
               filename_override: completeFileName,
               folder: "book-pdfs",
               format: "pdf",
            }
         );

         completeFileName = uploadResultPdf.secure_url;
         try {
            await fs.promises.unlink(bookFilePath);
         } catch (error) {
            return next(createHttpError(500, "Error while Deleting book PDF"));
         }
      }
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while uploading book pdf"));
   }

   try {
      const updatedBook = await bookModel.findOneAndUpdate(
         {
            _id: bookId,
         },
         {
            title: title,
            genre: genre,
            coverImage: completeCoverImage
               ? completeCoverImage
               : book.coverImage,
            file: completeFileName ? completeFileName : book.file,
         },
         {
            new: true,
         }
      );

      res.json(updatedBook);
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while updating book"));
   }
};

const listBooks = async (req: Request, res: Response, next: NextFunction) => {
   try {
      // TODO: Add Pagination
      const books = await bookModel.find().populate("author", "name");
      res.json(books);
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while listing books"));
   }
};

const getSingleBook = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   const bookId = req.params.bookId;

   try {
      const book = await bookModel
         .findOne({ _id: bookId })
         .populate("author", "name");

      if (!book) {
         return next(createHttpError(404, "Book Not Found!"));
      }

      return res.json(book);
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while Get single book!"));
   }
};

const deleteBook = async (req: Request, res: Response, next: NextFunction) => {
   const bookId = req.params.bookId;

   try {
      const book = await bookModel.findOne({ _id: bookId });

      if (!book) {
         return next(createHttpError(404, "Book Not Found!"));
      }

      // check access

      const _req = req as AuthRequest;

      if (book.author.toString() !== _req.userId) {
         return next(createHttpError(403, "Please Delete Your Own Book!"));
      }

      const coverFileSplits = book.coverImage.split("/");
      const coverImagePublicId =
         coverFileSplits.at(-2) +
         "/" +
         coverFileSplits.at(-1)?.split(".").at(-2);

      const bookFileSplits = book.file.split("/");
      const bookFilePublicId =
         bookFileSplits.at(-2) + "/" + bookFileSplits.at(-1);

      await cloudinary.uploader.destroy(coverImagePublicId);
      await cloudinary.uploader.destroy(bookFilePublicId, {
         resource_type: "raw",
      });

      await bookModel.deleteOne({ _id: bookId });

      res.sendStatus(204);
   } catch (error) {
      console.log(error);
      return next(createHttpError(500, "Error while Deleting book!"));
   }
};

export { createBook, updateBook, listBooks, getSingleBook, deleteBook };
