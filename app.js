// app.js
import express from 'express';
import path from 'path';
import routes from './routes/index.js';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

const app = express();
const PORT = 3001;

// ----------------------
// Middleware
// ----------------------
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(compression());
app.use(morgan('dev'));

// ----------------------
// Static files
// ----------------------
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ----------------------
// API Routes
// ----------------------
app.use('/api', routes);

// ----------------------
// Start server
// ----------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});