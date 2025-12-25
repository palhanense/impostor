import axios from 'axios';
import fs from 'fs';
import path from 'path';

const EVOLUTION_URL = 'http://localhost:8080';
const API_KEY = 'YOUR_EVOLUTION_KEY';
const INSTANCE_NAME = 'impostor-pay';

async function setup() {
    try {
        console.log("Checking Evolution API health...");
        await axios.get(`${EVOLUTION_URL}/`, { headers: { 'apikey': API_KEY } });
        console.log("Evolution API is UP.");

        console.log(`Creating instance '${INSTANCE_NAME}'...`);

        try {
            const createRes = await axios.post(`${EVOLUTION_URL}/instance/create`, {
                instanceName: INSTANCE_NAME,
                token: 'impostor-token',
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS'
            }, { headers: { 'apikey': API_KEY } });

            console.log("Instance created:", createRes.data);

        } catch (e: any) {
            console.log("Creation error:", e.message);
            if (e.response) console.log("Creation Details:", JSON.stringify(e.response.data, null, 2));
        }

        console.log("Fetching QR Code...");
        const connectRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, {
            headers: { 'apikey': API_KEY }
        });

        const qrData = connectRes.data;

        if (qrData && (qrData.base64 || qrData.qrcode)) {
            const base64 = (qrData.base64 || qrData.qrcode).replace(/^data:image\/png;base64,/, "");
            const outputPath = path.resolve(__dirname, '../artifacts/qrcode.png');

            if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });

            fs.writeFileSync(outputPath, base64, 'base64');
            console.log(`QR Code saved to: ${outputPath}`);
            console.log("SCAN THIS QR CODE WITH WHATSAPP!");
        } else {
            console.log("Instance already connected or no QR returned:", qrData);
        }

    } catch (error: any) {
        console.error("Setup Check Failed:", error.message);
        if (error.response) console.error("Response:", error.response.data);
    }
}

setup();
