import express from "express"
import { 
  createCreditNote, 
  createDebitNote, 
  getCreditNotes, 
  getDebitNote,
  updateDebitNote,
  updateCreditNote,
  deleteNote,
  getSingleNote,
  getNotePDF
} from "../controllers/noteController.js";

const router = express.Router()

router.post("/createDebitNote/:companyId", createDebitNote)
router.get("/getDebitnotes/:companyId", getDebitNote)
router.post("/createCreditNote/:companyId", createCreditNote)
router.get("/getAllCreditNotes/:companyId", getCreditNotes)

router.put("/updateDebitNote/:noteId", updateDebitNote)
router.put("/updateCreditNote/:noteId", updateCreditNote)
router.delete("/deleteNote/:noteId", deleteNote)
router.get("/getSingleNote/:noteId", getSingleNote)
router.get("/getNotePDF/:noteId", getNotePDF)

export default router;