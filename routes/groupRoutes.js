// import express from "express";
// import {
//   createGroup,
//   getGroups,
//   getGroupById,
//   updateGroup,
//   deleteGroup,
// } from "../controllers/groupController.js";

// const router = express.Router();

// router.post("/", createGroup);
// router.get("/", getGroups);
// router.get("/:id", getGroupById);
// router.put("/:id", updateGroup);
// router.delete("/:id", deleteGroup);

// export default router;


import express from "express";
import {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
} from "../controllers/groupController.js";

const router = express.Router();

//  All routes now include companyId
router.post("/:companyId", createGroup);
router.get("/all/:companyId", getGroups);
router.get("/:companyId/:id", getGroupById);
router.put("/:companyId/:id", updateGroup);
router.delete("/:companyId/:id", deleteGroup);

export default router;
