
import * as XLSX from 'xlsx';
import fs from 'fs';

const buf = fs.readFileSync('c:/sitrep/Template Data.xlsx');
const wb = XLSX.read(buf);
const sheetName = 'Kit'; // User mentioned "Kit" tab
if (!wb.Sheets[sheetName]) {
    console.log('Sheet "Kit" not found. Available:', wb.SheetNames);
} else {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    console.log('Headers:', data[0]);
    console.log('First Row:', data[1]);
}
