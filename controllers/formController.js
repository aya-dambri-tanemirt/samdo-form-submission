import { generatePDFBuffer } from '../services/pdfService.js';
import { uploadPDFToDrive, getOrCreateFolder } from '../services/googleDrive.js';
import { addRowToGoogleSheet, getOrCreateSheet } from '../services/excelService.js';

export const submitForm = async (req, res) => {
  try {
    const formData = {
      businessInfo: {
        contactType: req.body.contactType,
        businessName: req.body.businessName,
        category: req.body.category,
        country: req.body.country,
        website: req.body.website,
        targetMarkets: req.body.targetMarkets?.split(',') || []
      },
      contacts: JSON.parse(req.body.contacts || '[]'),
      brands: req.body.brands?.split(',') || [],
      otherBrand: req.body.otherBrand,
      keyContactPerson: req.body.keyContactPerson,
      comments: req.body.comment,
      newsletter: req.body.newsletter === 'true'
    };

    const today = new Date().toISOString().split('T')[0];

    const folderId = await getOrCreateFolder(today);
    const sheetId = await getOrCreateSheet(today, folderId);

    const pdfBuffer = await generatePDFBuffer(formData, req.files);
    const safeName = (formData.businessInfo.businessName || 'Submission').replace(/[^a-z0-9_\- ]/gi, '');
    const pdfFileName = `${safeName}-${today}.pdf`;

    const pdfRes = await uploadPDFToDrive(pdfBuffer, pdfFileName, folderId);
    await addRowToGoogleSheet(formData, sheetId, pdfRes.id);

    const pdfBase64 = pdfBuffer.toString('base64');

    res.json({
      success: true,
      pdfBase64,
      pdfFileName,
      sheetId,
      pdfId: pdfRes.id,
      pdfLink: pdfRes.webViewLink
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
