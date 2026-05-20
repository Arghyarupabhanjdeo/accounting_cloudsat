// import multer from "multer";
// import path from "path";
// import fs from "fs";

// // Ensure uploads folder exists
// const uploadDir = "./uploads";
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir);
// }

// // Storage config
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir); // Save in uploads/
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueSuffix + path.extname(file.originalname));
//   },
// });

// // File filter (allow images + pdf docs)
// const fileFilter = (req, file, cb) => {
//   const allowed = [".jpg", ".jpeg", ".png", ".pdf" , ".xls"];
//   const ext = path.extname(file.originalname).toLowerCase();
//   if (allowed.includes(ext)) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only images and PDF files are allowed"), false);
//   }
// };

// const upload = multer({ storage, fileFilter });

// export default upload;




import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".xls" || ext === ".xlsx") {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files allowed"), false);
  }
};

export default multer({ storage, fileFilter });

