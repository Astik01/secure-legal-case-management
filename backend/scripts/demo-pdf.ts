import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SeedCase, SOURCE_URL } from './seed-data';

// Standard PDF fonts only support WinAnsi; replace anything else defensively.
const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, ' ');

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of clean(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) {
      out.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) out.push(line);
  return out;
}

/** Generates a one-page, clearly labelled DEMONSTRATION summary sheet. It is not the judgment. */
export async function buildDemoPdf(c: SeedCase): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`DEMONSTRATION - ${clean(c.title)}`);
  pdf.setProducer('Secure Legal Case Management (demo seed)');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  let y = 800;
  const draw = (text: string, size = 10, f = font, color = rgb(0.1, 0.12, 0.2)) => {
    for (const l of wrap(text, Math.floor(88 * (10 / size)))) {
      page.drawText(l, { x: 50, y, size, font: f, color });
      y -= size + 5;
    }
  };

  page.drawRectangle({ x: 40, y: 770, width: 515, height: 50, color: rgb(0.99, 0.93, 0.8), borderColor: rgb(0.8, 0.5, 0.1), borderWidth: 1 });
  page.drawText('DEMONSTRATION MATERIAL - NOT AN OFFICIAL OR CERTIFIED COURT DOCUMENT', { x: 50, y: 800, size: 9.5, font: bold, color: rgb(0.5, 0.25, 0) });
  page.drawText('Generated for a student project. Refer to the Supreme Court of India for the authentic judgment.', { x: 50, y: 783, size: 8.5, font, color: rgb(0.5, 0.25, 0) });
  y = 745;
  draw(c.title, 16, bold);
  y -= 6;
  draw(`Citation: ${c.citation}`);
  draw(`Case number: ${c.caseNumber}`);
  draw(`Court: ${c.court}    Decided: ${c.decisionDate}`);
  draw(`Bench: ${c.bench}`);
  y -= 10;
  draw('Summary', 12, bold);
  draw(c.summary);
  y -= 8;
  draw('Key holdings', 12, bold);
  c.keyHoldings.forEach((h, i) => draw(`${i + 1}. ${h}`));
  y -= 8;
  draw(`Official judgments portal: ${SOURCE_URL}`, 9);
  return Buffer.from(await pdf.save());
}
