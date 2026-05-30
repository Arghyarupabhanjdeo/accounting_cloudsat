import pool from "./db.js";
async function check() { 
  const c = await pool.getConnection(); 
  const [s] = await c.query('DESCRIBE sales_vouchers'); 
  console.log('Sale:', s.map(x=>x.Field).join(', ')); 
  const [p] = await c.query('DESCRIBE purchase_vouchers'); 
  console.log('Purchase:', p.map(x=>x.Field).join(', ')); 
  const [cd] = await c.query('DESCRIBE debit_credit_notes');
  console.log('CreditDebit:', cd.map(x=>x.Field).join(', '));
  c.release(); 
  process.exit(0); 
} 
check();
