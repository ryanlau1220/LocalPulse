import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { extractFile, analyzeDocuments } from '../../lib/documents.js';

const fakeContent = 'Harbour Fixture Cafe serves coffee and pastries in Bangsar. Open daily.';
const file = (contents, name) => new File([contents], name);

test('extracts text from PDF, XLSX, DOCX, CSV and TXT', async () => {
  const pdf = new jsPDF(); pdf.text(fakeContent, 10, 20);
  assert.match(await extractFile(file(pdf.output('arraybuffer'), 'company.pdf')), /Harbour Fixture Cafe/);

  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Company');
  sheet.addRow(['Business', 'Harbour Fixture Cafe']); sheet.addRow(['Hours', 'Daily']);
  assert.match(await extractFile(file(await book.xlsx.writeBuffer(), 'company.xlsx')), /Harbour Fixture Cafe/);

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Harbour Fixture Cafe</w:t></w:r></w:p></w:body></w:document>');
  assert.match(await extractFile(file(await zip.generateAsync({ type:'nodebuffer' }), 'company.docx')), /Harbour Fixture Cafe/);
  assert.match(await extractFile(file('Name,Harbour Fixture Cafe', 'company.csv')), /Harbour Fixture Cafe/);
  assert.match(await extractFile(file(fakeContent, 'company.txt')), /Harbour Fixture Cafe/);
});

test('validates files and caches identical analyses without a second AI request', async () => {
  await assert.rejects(extractFile(file('not a PDF', 'bad.pdf')), /PDF/);
  await assert.rejects(extractFile(file('abc', 'bad.exe')), /Unsupported/);
  let calls = 0;
  const response = { businessName:'Harbour Fixture Cafe', category:'Cafe', location:'Bangsar', summary:'A fictional cafe.', opportunities:[{ title:'Add a menu', ms:'Tambah menu', detail:'Share the menu online.', msDetail:'Kongsi menu dalam talian.', priority:'High', effort:'2 hours' }] };
  const fetcher = async () => { calls++; return new Response(JSON.stringify({ candidates:[{ content:{ parts:[{ text:JSON.stringify(response) }] } }] }), { status:200, headers:{'Content-Type':'application/json'} }); };
  const files = [file(fakeContent, 'company.txt')];
  const first = await analyzeDocuments(files, 'Fixture test notes for website planning.', { key:'fixture-key', fetcher });
  const second = await analyzeDocuments(files, 'Fixture test notes for website planning.', { key:'fixture-key', fetcher });
  assert.equal(first.cached, false); assert.equal(second.cached, true); assert.equal(calls, 1);
  assert.equal(second.businessName, 'Harbour Fixture Cafe');
  await assert.rejects(analyzeDocuments([], '', { key:'fixture-key', fetcher }), /Add a file/);
});

test('extracts the provided sample company PDF', async () => {
  const contents = await readFile('public/samples/bluebird-company-information.pdf');
  const text = await extractFile(file(contents, 'bluebird-company-information.pdf'));
  assert.match(text, /Bluebird Corner Cafe/);
  assert.match(text, /menu, opening hours and location/);
});
