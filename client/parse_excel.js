import { createRequire } from 'module';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, '..', 'InitialData.xlsx');
const workbook = XLSX.readFile(filePath);

const result = {};

workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    result[sheetName] = data;
});

import { writeFileSync } from 'fs';
writeFileSync(join(__dirname, 'initial_data.json'), JSON.stringify(result, null, 2));
console.log('Data written to initial_data.json');
