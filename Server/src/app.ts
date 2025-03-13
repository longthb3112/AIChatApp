import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
//import { Send } from './Chat';
import { Send } from './chat-from-file';


dotenv.config(); // Load environment variables

const app = express();
const port = process.env.PORT || 9999;

console.log(process.env.PORT);

// Middleware to parse JSON requests
app.use(express.json());
app.use(cors({
     origin: '*', //Allow all hosts
    methods: ['GET', 'POST'], // Allow only GET and POST requests
    allowedHeaders: ['Content-Type'],
  }));

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.send('Hello, world!');
});

// API endpoint example
app.get('/api/data', (req: Request, res: Response) => {
  res.json({ message: 'This is your data' });
});

// POST /api/send route
app.post('/api/send', async  (req: Request, res: Response) => {
  const { messages } = req.body;
    console.log(messages);
    var responseMsg = await Send(messages);
     res.json({success: true, data : responseMsg });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
