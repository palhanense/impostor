import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('Impostor Pay Core Engine is Running! 🔪💰');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
