import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch'; // install: npm i node-fetch
import { submitForm } from '../controllers/formController.js';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

// HARDCODED Evolution API config
const EVO_URL = "http://localhost:8080/message/sendMedia/default";
const EVO_API_KEY = "53740E6C2AC4-438E-AAF1-4D5427488B54";  // <- your key

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 6 }
});

// ---------------- SUBMIT FORM ----------------
router.post('/submit-form', upload.array('attachments'), async (req, res) => {
  try {
    const result = await submitForm(req, res);
    return result;
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- SEND EMAIL ----------------
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

    res.json({ success, message: 'Email sent!' });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- SEND WHATSAPP ----------------
router.post('/send-whatsapp', upload.single('attachment'), async (req, res) => {
  try {
    const to = req.body.to;
    const message = req.body.message;
    const file = req.file;

    if (!to || !message) return res.status(400).json({ success: false, message: 'Missing parameters' });
    if (!file) return res.status(400).json({ success: false, message: 'Attachment missing' });

    const base64 = file.buffer.toString('base64');

    const payload = {
      number: to,
      mediatype: "document",
      mimetype: file.mimetype,
      fileName: file.originalname,
      caption: message,
      media: base64
    };

    const evolutionResponse = await fetch(EVO_URL, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "apikey": EVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await evolutionResponse.json();

    if (evolutionResponse.ok) {
      return res.json({ success: true, data });
    } else {
      return res.status(500).json({ success: false, message: JSON.stringify(data) });
    }

  } catch (error) {
    console.error("Error sending WhatsApp:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});


export default router;
