// controllers/formController.js
import { generatePDFBuffer } from '../services/pdfService.js';
import {
  getOrCreateFolder,
  getOrCreateFolderInParent,
  uploadPDFToDrive
} from '../services/googleDrive.js';

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

    // Root folder
    const ROOT_NAME = 'Submission';
    const rootFolderId = await getOrCreateFolder(ROOT_NAME);

    // Daily subfolder inside root
    const todayFolderId = await getOrCreateFolderInParent(rootFolderId, today);

    // Permanent sheet inside root
    const SHEET_NAME = 'Submissions';
    const sheetId = await getOrCreateSheet(SHEET_NAME, rootFolderId);

    // Generate PDF
    const pdfBuffer = await generatePDFBuffer(formData, req.files);
    const safeName = (formData.businessInfo.businessName || 'Submission')
      .replace(/[^a-z0-9_\- ]/gi, '');
    const pdfFileName = `${safeName}-${today}.pdf`;

    // Upload PDF into daily folder
    const pdfRes = await uploadPDFToDrive(pdfBuffer, pdfFileName, todayFolderId);

    // Append row to master sheet
    await addRowToGoogleSheet(formData, sheetId, pdfRes.id);

    res.json({
      success: true,
      pdfBase64: pdfBuffer.toString('base64'),
      pdfFileName,
      sheetId,
      pdfId: pdfRes.id,
      pdfLink: pdfRes.webViewLink
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
