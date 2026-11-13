// Ekstraksi teks PDF di worker thread agar server tetap responsif saat memproses buku besar.
import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { getDocumentProxy } from 'unpdf';

try {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(workerData.file)));
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => `${item.str || ''}${item.hasEOL ? '\n' : ''}`).join(''));
    page.cleanup();
    if (number % 20 === 0) parentPort.postMessage({ type: 'progress', done: number, total: pdf.numPages });
  }
  await (pdf.destroy?.() ?? pdf.cleanup?.());
  parentPort.postMessage({ type: 'done', totalPages: pages.length, pages });
} catch (error) {
  parentPort.postMessage({ type: 'error', message: error?.message || String(error) });
}
