require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ensureDatabase } = require('../src/config/ensureDb');

ensureDatabase()
  .then(() => {
    console.log('Schema aplicado com sucesso.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
