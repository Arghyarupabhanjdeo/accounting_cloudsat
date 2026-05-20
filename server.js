
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { urlencoded } from "express";
import companyRoutes from "./routes/companyRoutes.js";
import groupRoute from "./routes/groupRoutes.js";
import ledgerRoutes from "./routes/ledgerRoutes.js";
import purchaseVoucher from "./routes/purchaseVoucherRoute.js";
import saleRoutes from "./routes/saleVoucherRoutes.js";
import contraRoutes from "./routes/contraVoucherRoutes.js";
import journalRoutes from "./routes/journalVoucherRoutes.js";
import paymentRoutes from "./routes/paymentVoucherRoutes.js";
import trialBalanceRoutes from "./routes/trialBalanceRoutes.js";
import dayBookRoute from "./routes/dayBookRoutes.js";
import balanceSheetRoutes from "./routes/balanceSheetRoutes.js"
import transactionRoutes from "./routes/transactionRoutes.js"
import profitLossRoutes from "./routes/profitLossRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import gstr1Routes from "./routes/gstr1Routes.js"
import voucherRoutes from "./routes/voucherRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import manufacturingRoutes from "./routes/manufacturingRoute.js";
import stockRoutes from "./routes/stockRoutes.js";
import receiveRoutes from "./routes/reciptVoucherRoutes.js";
import bankRoutes from "./routes/bankAccountsRoutes.js"
import bankTransactions from "./routes/bankTransactionRoutes.js";
import checkRoutes from "./routes/chequeRoutes.js";
import gstr2aRoutes from "./routes/gstr2aRoutes.js";
import gstr2bRoutes from "./routes/gstr2bRoutes.js";

import invoiceRoutes from "./routes/invoiceRoutes.js";
import challanRoutes from "./routes/challanRoutes.js";
// import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import { initSubscriptionCron } from "./utils/subscriptionCron.js";

const app = express();


const allowOrigins = ["http://localhost:5173", "http://localhost:5174", "https://accounting.csaap.com", "https://buildererp.csaap.com", "https://cloudsat.in/", "https://www.cloudsat.in/,"];

app.use(
  cors({
    origin: allowOrigins,
    credentials: true // Allow cookies to be sent with cross-origin requests
  })
);


app.use(express.json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser()); // Parse cookies from requests
app.use("/uploads", express.static("uploads"));


app.use("/api/v1/company", companyRoutes);
app.use("/api/v1/group", groupRoute);
app.use("/api/v1/ledger", ledgerRoutes);
app.use("/api/v1/purchase-voucher", purchaseVoucher);
app.use("/api/v1/sale-voucher", saleRoutes);
app.use("/api/v1/contra-voucher", contraRoutes);
app.use("/api/v1/journal-voucher", journalRoutes);
app.use("/api/v1/payment-voucher", paymentRoutes);
app.use('/api/v1/receive-voucher', receiveRoutes);
app.use("/api/v1/trial-balance", trialBalanceRoutes);
app.use("/api/v1/daybook", dayBookRoute);
app.use("/api/v1/balanceSheet", balanceSheetRoutes);
app.use("/api/v1/transaction", transactionRoutes);
app.use("/api", profitLossRoutes);
app.use("/api/v1/auth", userRoutes);
app.use("/api/v1/voucher", voucherRoutes)
app.use("/api/v1/notes", noteRoutes)
app.use("/api/v1/manufacturing", manufacturingRoutes);
app.use("/api/v1/stock", stockRoutes);
app.use("/api/v1/bank", bankRoutes);
app.use("/api/v1/bank-transaction", bankTransactions);
app.use('/api/v1/cheque', checkRoutes);
app.use("/api/v1/gstr1", gstr1Routes);
app.use("/api/v1/gstr2a", gstr2aRoutes);
app.use("/api/v1/gstr2b", gstr2bRoutes);
app.use("/api/v1/invoice", invoiceRoutes);
app.use("/api/v1/challans ", challanRoutes);
// app.use("/api/v1/subscription", subscriptionRoutes);
app.get("/", (req, res) => {
  res.send("Server Is Running ......");
})

app.listen(process.env.PORT, () => {
  console.log(`Server is running at http://localhost:${process.env.PORT || 5000}`);

  // Initialize subscription expiration cron job
  initSubscriptionCron();
});


//http://localhost:3000/api/v1/bank
//http://localhost:3000/api/v1/balanceSheet