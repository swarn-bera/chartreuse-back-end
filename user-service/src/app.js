import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/auth.route.js';
import { errorHandler } from './middlewares/error.middleware.js';

dotenv.config();

const app = express();

app.use(express.json());
app.use('/api/v1/users', userRoutes);

app.get('/', (_req, res) => {
  res.send('User Service is up and running');
});

app.use(errorHandler);

export default app;
