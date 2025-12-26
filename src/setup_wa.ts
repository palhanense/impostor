import axios from 'axios';
import qrcode from 'qrcode-terminal';

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EVOLUTION_API_KEY || 'YOUR_EVOLUTION_KEY';
const INSTANCE_NAME = 'ImpostorBot';

async function setup() {
    try {
        console.log(`Checking Evolution API at ${EVOLUTION_URL}...`);
        await axios.get(`${EVOLUTION_URL}/`, { headers: { 'apikey': API_KEY } });
        console.log("Evolution API is UP.");

        console.log(`Creating/Connecting instance '${INSTANCE_NAME}'...`);

        // Check if exists
        try {
            await axios.get(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, { headers: { 'apikey': API_KEY } });
        } catch (e) {
            // Create if not exists
            await axios.post(`${EVOLUTION_URL}/instance/create`, {
                instanceName: INSTANCE_NAME,
                token: 'impostor-token',
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS'
            }, { headers: { 'apikey': API_KEY } });
        }

        console.log("Fetching QR Code...");
        const connectRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, {
            headers: { 'apikey': API_KEY }
        });

        const qrData = connectRes.data;

        if (qrData && (qrData.base64 || qrData.qrcode)) {
            // Some versions return code details object, some base64.
            // If base64:
            // qrcode-terminal expects STRING.
            // If it is 'data:image...', base64. 
            // Wait, qrcode-terminal input is TEXT to encode?
            // "qrcode": true in create returns { qrcode: { ...base64... }, code: "..." } ?
            // Evolution v2.1 returns base64 usually.
            // qrcode-terminal prints the QR representation OF THE TEXT.
            // If I give it Base64 IMAGE data, it prints a QR of the Base64 string! That's WRONG.
            // I need the pairing CODE (text) or decipher the base64?
            // Wait, Evolution API `instance/connect` returns `base64`.
            // The logic: Base64 -> Image -> Scan.
            // ASCII QR?
            // `qrcode-terminal` expects the CONTENT of the QR.
            // I don't have the content (the actual pairing code), I have the IMAGE.

            // Re-read Evolution Docs?
            // Usually Evolution returns `{ code: "2@...", base64: "..." }`. "code" is the content.
            // Check logs from step 1586? Not printed.

            if (qrData.code) {
                qrcode.generate(qrData.code, { small: true });
            } else {
                console.log("QR Code (Base64 only, cannot print to terminal):");
                console.log(qrData.base64);
            }
        } else {
            console.log("Instance Connected or No QR:", qrData);
        }

    } catch (error: any) {
        console.error("Setup Failed:", error.message);
        if (error.response) console.error("Response:", error.response.data);
    }
}

setup();
