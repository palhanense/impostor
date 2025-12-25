import axios from 'axios';
import fs from 'fs';
import path from 'path';

const EVOLUTION_URL = 'http://localhost:8080';
const API_KEY = 'YOUR_EVOLUTION_KEY';
const INSTANCE_NAME = 'impostor-pay';

async function reset() {
    try {
        console.log("Deleting Instance...");
        try {
            await axios.delete(`${EVOLUTION_URL}/instance/delete/${INSTANCE_NAME}`, {
                headers: { 'apikey': API_KEY }
            });
            console.log("Deleted.");
        } catch (e: any) {
            console.log("Delete failed (maybe didn't exist):", e.message);
        }

        await new Promise(r => setTimeout(r, 2000));

        console.log("Creating Instance...");
        const createRes = await axios.post(`${EVOLUTION_URL}/instance/create`, {
            instanceName: INSTANCE_NAME,
            token: 'impostor-token',
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
        }, { headers: { 'apikey': API_KEY } });

        console.log("Create Response:", JSON.stringify(createRes.data, null, 2));

        if (createRes.data.qrcode && createRes.data.qrcode.base64) {
            saveQR(createRes.data.qrcode.base64);
        } else {
            console.log("No QR in creation. Fetching...");
            await new Promise(r => setTimeout(r, 3000));
            fetchQR();
        }

    } catch (e: any) {
        console.error("Error:", e.message);
        if (e.response) console.log(e.response.data);
    }
}

async function fetchQR() {
    try {
        const connectRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, {
            headers: { 'apikey': API_KEY }
        });
        const qrData = connectRes.data;
        if (qrData && (qrData.base64 || qrData.qrcode)) {
            saveQR(qrData.base64 || qrData.qrcode);
        } else {
            console.log("Still no QR:", qrData);
        }
    } catch (e) { console.log("Fetch Error", e); }
}

function saveQR(base64: string) {
    const clean = base64.replace(/^data:image\/png;base64,/, "");
    const outputPath = path.resolve(__dirname, '../artifacts/qrcode.png');
    if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, clean, 'base64');
    console.log(`QR Code saved to: ${outputPath}`);
}

reset();
