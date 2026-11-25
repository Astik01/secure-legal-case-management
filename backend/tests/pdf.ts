import { PDFDocument, StandardFonts } from 'pdf-lib';

/** Builds a small valid PDF containing the text (clearly labelled demo content in tests). */
export async function makePdf(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([400, 200]);
  page.drawText(`DEMONSTRATION DOCUMENT - ${text}`, { x: 20, y: 100, size: 10, font });
  return Buffer.from(await pdf.save());
}
