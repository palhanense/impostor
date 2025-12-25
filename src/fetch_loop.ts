import axios from 'axios';
import fs from 'fs';
import path from 'path';

const EVOLUTION_URL = 'http://localhost:8080';
const API_KEY = 'YOUR_EVOLUTION_KEY';
const INSTANCE_NAME = 'impostor-pay';

async function loop() {
    for (let i = 0; i < 20; i++) {
        try {
            console.log(`Attempt ${i + 1}...`);
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
                console.log("SUCCESS");
                return;
            } else {
                console.log("No QR yet.");
            }
        } catch (e: any) {
            console.log("Error:", e.message);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("GIVE UP");
}

loop();
