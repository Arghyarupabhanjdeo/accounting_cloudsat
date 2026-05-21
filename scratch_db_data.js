import mysql from 'mysql2/promise';

async function run() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });

    console.log('Connected to MySQL server.');

    // Fetch some users and employees from superadmin
    try {
      await connection.query('USE superadmin');
      const [users] = await connection.query('SELECT id, name, email, role, branch_id FROM users LIMIT 5');
      console.log('\nsuperadmin.users (first 5):', users);

      const [emps] = await connection.query('SELECT id, company_id, user_id, name, email FROM employees LIMIT 5');
      console.log('\nsuperadmin.employees (first 5):', emps);
    } catch (e) {
      console.error(e);
    }

    // Fetch some users and companies from accounting_cloudsat
    try {
      await connection.query('USE accounting_cloudsat');
      const [users] = await connection.query('SELECT id, name, email, role, subdomain FROM users LIMIT 5');
      console.log('\naccounting_cloudsat.users (first 5):', users);

      const [comps] = await connection.query('SELECT id, userId, name, email FROM companies LIMIT 5');
      console.log('\naccounting_cloudsat.companies (first 5):', comps);
    } catch (e) {
      console.error(e);
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
