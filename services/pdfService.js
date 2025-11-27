// services/pdfService.js
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Size threshold for embedding images (bytes). Images larger than this will be skipped to speed up generation.
// Increase if you want to embed very large images, but performance will drop.
const IMAGE_EMBED_MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

export async function generatePDFBuffer(formData, attachments = []) {
  try {
    const templatePath = path.join(__dirname, '..', 'pdf', 'Form_Submission.pdf');

    // If template exists, load it; otherwise start a fresh PDF
    let pdfDoc;
    try {
      const templateBytes = await fs.readFile(templatePath);
      pdfDoc = await PDFDocument.load(templateBytes);
    } catch (err) {
      // Template missing → create a blank new document
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage(); // ensure at least one page
    }

    const pages = pdfDoc.getPages();
    let currentPage = pages[0];
    let { width, height } = currentPage.getSize();
    let yPos = height - 80;

    const drawHeader = (text) => {
      currentPage.drawText(text, { x: 90, y: yPos, size: 18 });
      yPos -= 30;
    };

    drawHeader('SAMDO Auto Spare Parts - Form Submission');

    // Business Info
    currentPage.drawText('Business Information:', { x: 50, y: yPos, size: 14 });
    yPos -= 18;
    currentPage.drawText(`Business Name: ${formData.businessInfo.businessName || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 14;
    currentPage.drawText(`Category: ${formData.businessInfo.category || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 14;
    currentPage.drawText(`Country: ${formData.businessInfo.country || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 14;
    currentPage.drawText(`Website: ${formData.businessInfo.website || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 14;
    currentPage.drawText(`Target Markets: ${formData.businessInfo.targetMarkets?.join(', ') || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 24;

    // Contact Info
    currentPage.drawText('Contact Information:', { x: 50, y: yPos, size: 14 });
    yPos -= 18;

    for (const [index, contact] of (formData.contacts || []).entries()) {
      if (yPos < 120) {
        currentPage = pdfDoc.addPage([width, height]);
        yPos = height - 50;
      }

      currentPage.drawText(`Contact ${index + 1}:`, { x: 60, y: yPos, size: 12 });
      yPos -= 14;
      currentPage.drawText(`  Name: ${contact.name || ''}`, { x: 70, y: yPos, size: 12 });
      yPos -= 14;
      currentPage.drawText(`  Phone: ${(contact.countryCode || '')} ${contact.phone || ''}`, { x: 70, y: yPos, size: 12 });
      yPos -= 14;
      currentPage.drawText(`  Email: ${contact.email || ''}`, { x: 70, y: yPos, size: 12 });
      yPos -= 14;
      currentPage.drawText(`  Occupation: ${contact.occupation || ''}`, { x: 70, y: yPos, size: 12 });
      yPos -= 14;
      currentPage.drawText(`  Preferred Language: ${contact.language || ''}`, { x: 70, y: yPos, size: 12 });
      yPos -= 20;
    }

    // Brand info — draw only if present
    if ((formData.brands?.length && formData.brands.some(b => b)) || formData.otherBrand) {
      if (yPos < 120) {
        currentPage = pdfDoc.addPage([width, height]);
        yPos = height - 50;
      }
      currentPage.drawText('Brand Inquiry:', { x: 50, y: yPos, size: 14 });
      yPos -= 16;

      if (formData.brands?.length && formData.brands.some(b => b)) {
        currentPage.drawText(`Selected Brands: ${formData.brands.join(', ')}`, { x: 60, y: yPos, size: 12 });
        yPos -= 14;
      }
      if (formData.otherBrand) {
        currentPage.drawText(`Other Brand: ${formData.otherBrand}`, { x: 60, y: yPos, size: 12 });
        yPos -= 14;
      }
      yPos -= 10;
    }

    // Attachments embedding — embed only images and only when not too big to avoid long processing
    if (attachments && attachments.length) {
      // try to embed images, but skip huge files
      for (const file of attachments) {
        const fileName = file.originalname || '';
        const ext = path.extname(fileName).toLowerCase();
        const imageExts = ['.png', '.jpg', '.jpeg'];

        // prefer image embedding only
        if (!imageExts.includes(ext)) continue;

        // buffer is from multer.memoryStorage: file.buffer
        const buf = file.buffer || null;
        if (!buf) continue;

        // skip very large images (configurable)
        if (buf.length > IMAGE_EMBED_MAX_BYTES) {
          console.log(`[PDF] Skipping large image embed: ${fileName} (${Math.round(buf.length/1024)} KB)`);
          continue;
        }

        try {
          let embeddedImage;
          if (ext === '.png') embeddedImage = await pdfDoc.embedPng(buf);
          else embeddedImage = await pdfDoc.embedJpg(buf);

          if (!embeddedImage) continue;

          const dims = embeddedImage.scale(1);
          const maxW = 420;
          const maxH = 240;
          let scale = 1;
          if (dims.width > maxW) scale = maxW / dims.width;
          if (dims.height * scale > maxH) scale = maxH / dims.height;
          const w = dims.width * scale;
          const h = dims.height * scale;

          if (yPos - h < 60) {
            currentPage = pdfDoc.addPage([width, height]);
            yPos = height - 50;
          }

          currentPage.drawImage(embeddedImage, { x: 60, y: yPos - h, width: w, height: h });
          yPos -= (h + 18);
        } catch (err) {
          console.warn(`[PDF] failed to embed ${fileName}:`, err?.message || err);
        }

        if (yPos < 60) {
          currentPage = pdfDoc.addPage([width, height]);
          yPos = height - 50;
        }
      }

      // spacing after attachments
      yPos -= 20;
    }

    // Additional Info
    if (yPos < 120) {
      currentPage = pdfDoc.addPage([width, height]);
      yPos = height - 50;
    }
    currentPage.drawText('Additional Information:', { x: 50, y: yPos, size: 14 });
    yPos -= 16;
    currentPage.drawText(`Key Contact Person: ${formData.keyContactPerson || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 14;
    currentPage.drawText(`Comment/Remark: ${formData.comments || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 14;
    currentPage.drawText(`Newsletter Subscription: ${formData.newsletter ? 'Yes' : 'No'}`, { x: 60, y: yPos, size: 12 });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}
