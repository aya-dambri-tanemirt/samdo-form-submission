// index.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const XLSX = require('xlsx');
const fs = require('fs'); 
const fsPromises = require('fs').promises;
const { PDFDocument: PDFLibDocument } = require('pdf-lib');

require('dotenv').config();

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Use regular fs for synchronous operations
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Helper function to read existing Excel file from S3 or create new one
async function getOrCreateExcelFile() {
  const params = {
    Bucket: 'www.virta-calls.com',
    Key: 'SAMDO/samdo_inquiries.xlsx'
  };

  try {
    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Read the existing file content
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook;
  } catch (error) {
    // If file doesn't exist, create a new workbook with headers
    console.log('No existing file found, creating new one');
    const wb = XLSX.utils.book_new();

    // Define the columns based on your requirements
    const headers = [
      'Business Name', 'Category', 'Country', 'Website', 'Target Market',
      'Name', 'Phone', 'Email', 'Occupation', 'Prefer Language',
      'Brand', 'Other Brand', 'Attachment', 'Key Contact Person', 'Comments'
    ];

    // Create worksheet with headers
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, 'Inquiries');

    return wb;
  }
}

// Function to add row to Excel file
async function addRowToExcelFile(formData, attachments) {
  try {
    // Get existing workbook or create new one
    const workbook = await getOrCreateExcelFile();

    // Get the first sheet (Inquiries)
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Process all contacts into semicolon-separated strings
    const contactNames = formData.contacts.map(contact => contact.name).filter(name => name).join('; ');
    const contactPhones = formData.contacts.map(contact =>
      contact.phone ? `${contact.countryCode} ${contact.phone}` : ''
    ).filter(phone => phone).join('; ');

    const contactEmails = formData.contacts.map(contact => contact.email).filter(email => email).join('; ');
    const contactOccupations = formData.contacts.map(contact => contact.occupation).filter(occ => occ).join('; ');
    const contactLanguages = formData.contacts.map(contact => contact.language).filter(lang => lang).join('; ');

    // Extract data for the new row
    const rowData = [
      formData.businessInfo.businessName || '',
      formData.businessInfo.category || '',
      formData.businessInfo.country || '',
      formData.businessInfo.website || '',
      formData.businessInfo.targetMarkets ? formData.businessInfo.targetMarkets.join(', ') : '',
      contactNames,
      contactPhones,
      contactEmails,
      contactOccupations,
      contactLanguages,
      formData.brands ? formData.brands.join(', ') : '',
      formData.otherBrand || '',
      attachments && attachments.length > 0 ? attachments.map(a => a.originalname).join(', ') : '',
      formData.keyContactPerson || '',
      formData.comments || ''
    ];

    // Add the new row to the worksheet
    XLSX.utils.sheet_add_aoa(worksheet, [rowData], { origin: -1 });

    // Convert workbook to buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Upload to S3
    const params = {
      Bucket: 'www.virta-calls.com',
      Key: 'SAMDO/samdo_inquiries.xlsx',
      Body: buffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    return { success: true, message: 'Row added successfully' };
  } catch (error) {
    console.error('Error adding row to Excel file:', error);
    throw error;
  }
}

// Function to generate PDF
async function generatePDF(formData, attachments) {
  try {
    // Load the existing PDF template
    const templatePath = path.join(__dirname, 'pdf', 'Form_Submission.pdf');

    // Check if template exists - use fsPromises
    try {
      await fsPromises.access(templatePath);
    } catch (error) {
      throw new Error(`PDF template not found at: ${templatePath}`);
    }

    // Read the PDF template - use fsPromises
    const templateBytes = await fsPromises.readFile(templatePath);
    const pdfDoc = await PDFLibDocument.load(templateBytes);

    // Get the first page (you can modify this if you need multiple pages)
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Get page dimensions
    const { width, height } = firstPage.getSize();

    // Draw form data on the PDF
    firstPage.drawText('SAMDO Auto Spare Parts - Form Submission', {
      x: 90,
      y: height - 85,
      size: 18,
    });

    // Business Information
    let yPos = height - 120;
    firstPage.drawText('Business Information:', { x: 50, y: yPos, size: 14 });
    yPos -= 20;

    firstPage.drawText(`Business Name: ${formData.businessInfo.businessName || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 20;
    firstPage.drawText(`Category: ${formData.businessInfo.category || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 20;
    firstPage.drawText(`Country: ${formData.businessInfo.country || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 20;
    firstPage.drawText(`Website: ${formData.businessInfo.website || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 20;
    firstPage.drawText(`Target Markets: ${formData.businessInfo.targetMarkets ? formData.businessInfo.targetMarkets.join(', ') : ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 30;

    // Contact Information
    firstPage.drawText('Contact Information:', { x: 50, y: yPos, size: 14 });
    yPos -= 20;

    formData.contacts.forEach((contact, index) => {
      // Check if we need a new page
      if (yPos < 100) {
        const newPage = pdfDoc.addPage([width, height]);
        yPos = height - 50;

        newPage.drawText(`Contact ${index + 1}:`, { x: 60, y: yPos, size: 12 });
        yPos -= 15;
        newPage.drawText(`  Name: ${contact.name || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 15;
        newPage.drawText(`  Phone: ${contact.countryCode || ''} ${contact.phone || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 15;
        newPage.drawText(`  Email: ${contact.email || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 15;
        newPage.drawText(`  Occupation: ${contact.occupation || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 15;
        newPage.drawText(`  Preferred Language: ${contact.language || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 20;
      } else {
        firstPage.drawText(`Contact ${index + 1}:`, { x: 60, y: yPos, size: 12 });
        yPos -= 15;
        firstPage.drawText(`  Name: ${contact.name || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 15;
        firstPage.drawText(`  Phone: ${contact.countryCode || ''} ${contact.phone || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 15;
        firstPage.drawText(`  Email: ${contact.email || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 15;
        firstPage.drawText(`  Occupation: ${contact.occupation || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 15;
        firstPage.drawText(`  Preferred Language: ${contact.language || ''}`, { x: 70, y: yPos, size: 12 });
        yPos -= 20;
      }
    });

    yPos -= 10;

    // Check if we need a new page
    if (yPos < 100) {
      const newPage = pdfDoc.addPage([width, height]);
      yPos = height - 50;
    }

    // Brand Information
    const currentPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    currentPage.drawText('Brand Inquiry:', { x: 50, y: yPos, size: 14 });
    yPos -= 20;
    currentPage.drawText(`Selected Brands: ${formData.brands ? formData.brands.join(', ') : ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 20;
    currentPage.drawText(`Other Brand: ${formData.otherBrand || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 30;

    // Check if we need a new page
    if (yPos < 100) {
      const newPage = pdfDoc.addPage([width, height]);
      yPos = height - 50;
    }

    // Attachment Information with Images
    const attachmentPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    attachmentPage.drawText('Attachments:', { x: 50, y: yPos, size: 14 });
    yPos -= 20;

    if (attachments && attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const fileName = attachment.originalname || 'Unknown file';

        const activePage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
        activePage.drawText(`${i + 1}. ${fileName}`, {
          x: 60,
          y: yPos,
          size: 12
        });
        yPos -= 15;

        // Check if it's an image file
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
        const fileExt = path.extname(fileName).toLowerCase();

        if (imageExtensions.includes(fileExt)) {
          try {
            // Read the image file - use fsPromises
            const imageBytes = await fsPromises.readFile(attachment.path);

            let image;
            if (fileExt === '.png') {
              image = await pdfDoc.embedPng(imageBytes);
            } else if (fileExt === '.jpg' || fileExt === '.jpeg') {
              image = await pdfDoc.embedJpg(imageBytes);
            }

            if (image) {
              // Calculate dimensions to fit the image nicely
              const maxWidth = 400;
              const maxHeight = 200;
              const imgDims = image.scale(1);

              let scale = 1;
              if (imgDims.width > maxWidth) {
                scale = maxWidth / imgDims.width;
              }
              if (imgDims.height * scale > maxHeight) {
                scale = maxHeight / imgDims.height;
              }

              const scaledWidth = imgDims.width * scale;
              const scaledHeight = imgDims.height * scale;

              // Check if we need a new page
              if (yPos - scaledHeight < 50) {
                const newPage = pdfDoc.addPage([width, height]);
                yPos = height - 50;
                newPage.drawImage(image, {
                  x: 120,
                  y: yPos - scaledHeight,
                  width: scaledWidth,
                  height: scaledHeight,
                });
                yPos -= (scaledHeight + 20);
              } else {
                const currentImgPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
                currentImgPage.drawImage(image, {
                  x: 60,
                  y: yPos - scaledHeight,
                  width: scaledWidth,
                  height: scaledHeight,
                });
                yPos -= (scaledHeight + 20);
              }
            }
          } catch (imgError) {
            console.error(`Error embedding image ${fileName}:`, imgError);
            const errorPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
            errorPage.drawText(`  (Image could not be embedded)`, { x: 70, y: yPos, size: 10 });
            yPos -= 15;
          }
        }

        // Reset to top if running out of space
        if (yPos < 50) {
          const newPage = pdfDoc.addPage([width, height]);
          yPos = height - 50;
        }
      }
    } else {
      const noAttachPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
      noAttachPage.drawText('No attachments provided', { x: 60, y: yPos, size: 12 });
      yPos -= 20;
    }

    yPos -= 10;

    // Additional Information
    if (yPos < 100) {
      const newPage = pdfDoc.addPage([width, height]);
      yPos = height - 50;
    }

    const finalPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    finalPage.drawText('Additional Information:', { x: 50, y: yPos, size: 14 });
    yPos -= 20;
    finalPage.drawText(`Key Contact Person: ${formData.keyContactPerson || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 20;
    finalPage.drawText(`Comment/Remark: ${formData.comments || ''}`, { x: 60, y: yPos, size: 12 });
    yPos -= 20;
    finalPage.drawText(`Newsletter Subscription: ${formData.newsletter ? 'Yes' : 'No'}`, { x: 60, y: yPos, size: 12 });

    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();

    // Convert to Buffer
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error generating PDF from template:', error);
    throw error;
  }
}

// Form submission endpoint
app.post('/api/submit-form', upload.array('attachments'), async (req, res) => {
  try {
    console.log('Request files:', req.files);  // Debug line
    console.log('Request body:', req.body);    // Debug line

    const formData = JSON.parse(req.body.formData);
    const attachments = req.files;

    // Log received data for debugging
    console.log('Received form data:', JSON.stringify(formData, null, 2));
    console.log('Received attachments:', attachments);

    // Add the new row to the Excel file
    await addRowToExcelFile(formData, attachments);

    // Generate PDF with attachments
    const pdfBuffer = await generatePDF(formData, attachments);

    // Upload PDF to S3
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfKey = `SAMDO/inquiries/${timestamp}_inquiry.pdf`;
    const pdfParams = {
      Bucket: 'www.virta-calls.com',
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf'
    };

    const pdfCommand = new PutObjectCommand(pdfParams);
    await s3Client.send(pdfCommand);

    // Generate public URL for the PDF
    const pdfUrl = `https://s3.eu-north-1.amazonaws.com/www.virta-calls.com/${pdfKey}`;

    // Return success response with contact information and PDF URL
    res.status(200).json({
      success: true,
      message: 'Form submitted successfully',
      contacts: formData.contacts,
      pdfUrl: pdfUrl
    });
  } catch (error) {
    console.error('Error processing form submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing form submission',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Serve static files (your HTML)
app.use(express.static('.'));

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access the form at: http://localhost:${PORT}/index.html`);
});

module.exports = app;