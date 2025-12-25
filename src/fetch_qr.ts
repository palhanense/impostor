import axios from 'axios';
import fs from 'fs';
import path from 'path';

const EVOLUTION_URL = 'http://localhost:8080';
const API_KEY = 'YOUR_EVOLUTION_KEY';
const INSTANCE_NAME = 'impostor-pay';

async function fetchQR() {
    try {
        console.log("Fetching QR Code...");
        const connectRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, {
            headers: { 'apikey': API_KEY }
        });

        const qrData = connectRes.data;
        console.log("Data:", qrData);

        if (qrData && (qrData.base64 || qrData.qrcode)) {
            const base64 = (qrData.base64 || qrData.qrcode).replace(/^data:image\/png;base64,/, "");
            const outputPath = path.resolve(__dirname, '../artifacts/qrcode.png');

            if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });

            fs.writeFileSync(outputPath, base64, 'base64');
            console.log(`QR Code saved to: ${outputPath}`);
        } else {
            console.log("No QR Code yet. Try again in 5s.");
        }
    } catch (e: any) {
        console.error("Error:", e.message);
        if (e.response) console.log(e.response.data);
    }
}

fetchQR();
