// routes/cheque.js
import express from 'express';
import {
  createCheque,
  getChequesForCompany,
  getChequeById,
  updateCheque,
  deleteCheque,
  changeChequeStatus,
  addCheque,
  updateChequeList,
  getChequeList,
  deleteChequeList
} from '../controllers/chequeController.js';

const router = express.Router();

// Create
router.post('/:companyId/create', createCheque);

// Get all for company
router.get('/:companyId/all', getChequesForCompany);

// Single cheque
router.get('/item/:id', getChequeById);

// Update
router.put('/:id/update', updateCheque);

// Delete
router.delete('/:id/delete', deleteCheque);

// quick status change
router.post('/:id/change-status', changeChequeStatus);

// add cheque
router.post("/addCheque/:companyId",addCheque)

//update cheque 
router.put("/updateCheque/:id",updateChequeList);

router.get("/getAllcheque/:companyId",getChequeList)

//delete cheque
router.delete("/deleteCheque/:id",deleteChequeList);
export default router;
