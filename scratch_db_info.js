import mysql from 'mysql2/promise';

async function run() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });

    console.log('Connected to MySQL server.');

    await connection.query('USE accounting_cloudsat');
    
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    for (const tableName of tableNames) {
      const [cols] = await connection.query(`DESCRIBE ${tableName}`);
      const matchingCols = cols.filter(c => c.Field.toLowerCase() === 'userid' || c.Field.toLowerCase() === 'user_id');
      if (matchingCols.length > 0) {
        console.log(`Table: ${tableName} has column: ${matchingCols.map(c => c.Field).join(', ')}`);
      }
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
