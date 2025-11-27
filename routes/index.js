import express from 'express';
import multer from 'multer';
import { submitForm } from '../controllers/formController.js';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 6 }
});

// Submit form
router.post('/submit-form', upload.array('attachments'), async (req, res) => {
  try {
    const result = await submitForm(req, res);
    return result;
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Send email
router.post('/send-email', upload.single('attachment'), async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const file = req.file;

    if (!to || !subject || !body)
      return res.status(400).json({ success: false, message: 'Missing required fields' });

    if (!file)
      return res.status(400).json({ success: false, message: 'No attachment provided' });

    const success = await sendEmail({
      to,
      subject,
      body,
      attachmentBuffer: file.buffer,
      attachmentName: file.originalname
    });

    res.json({ success , message: 'Email sent!'});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

