import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const data = JSON.parse(readFileSync(join(__dirname, 'initial_data.json'), 'utf8'));
console.log(Object.keys(data));
