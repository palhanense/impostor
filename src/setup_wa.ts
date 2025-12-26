import axios from 'axios';
import qrcode from 'qrcode-terminal';

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EVOLUTION_API_KEY || 'YOUR_EVOLUTION_KEY';
const INSTANCE_NAME = 'ImpostorBot6';

// Helper to check valid QR
function hasValidQR(d: any) {
    const q = d?.qrcode || d?.item || d;
    return (q?.base64 || q?.code || q?.pairingCode) && typeof (q?.base64 || q?.code || q?.pairingCode) === 'string';
}

async function setup() {
    try {
        console.log(`Checking Evolution API at ${EVOLUTION_URL}...`);
        await axios.get(`${EVOLUTION_URL}/`, { headers: { 'apikey': API_KEY } });
        console.log("Evolution API is UP.");

        let qrData: any = null;

        console.log(`Creating/Checking instance '${INSTANCE_NAME}'...`);
        try {
            // Try Create
            const createRes = await axios.post(`${EVOLUTION_URL}/instance/create`, {
                instanceName: INSTANCE_NAME,
                token: 'impostor-token',
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS'
            }, { headers: { 'apikey': API_KEY } });
            console.log("Instance created.");
            qrData = createRes.data;
        } catch (e: any) {
            console.log("Create failed (maybe exists):", e.message);
        }

        // Retry Loop
        if (!hasValidQR(qrData)) {
            console.log("QR missing. Attempting Logout/Connect Kickstart...");
            try {
                await axios.delete(`${EVOLUTION_URL}/instance/logout/${INSTANCE_NAME}`, { headers: { 'apikey': API_KEY } });
                console.log("Logout triggered to reset state.");
            } catch (e) { console.log("Logout failed (ignored):", e.message); }

            console.log("Entering Retry Loop (max 5 attempts)...");

            for (let i = 1; i <= 5; i++) {
                console.log(`Attempt ${i}/5 - Fetching QR via Connect...`);
                try {
                    const connectRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, {
                        headers: { 'apikey': API_KEY }
                    });

                    if (hasValidQR(connectRes.data)) {
                        qrData = connectRes.data;
                        console.log("QR Fetched Successfully!");
                        break;
                    } else {
                        console.log("Response still missing QR:", JSON.stringify(connectRes.data));
                    }
                } catch (e: any) {
                    console.log(`Attempt ${i} failed:`, e.message);
                }

                if (i < 5) await new Promise(r => setTimeout(r, 6000)); // Wait 6s
            }
        }

        // Deep extraction for Evolution v2
        const qrcodeObj = qrData?.qrcode || qrData?.item || qrData;
        const possibleBase64 = qrcodeObj?.base64 || qrcodeObj?.qrcode;
        const possibleCode = qrcodeObj?.code || qrcodeObj?.pairingCode || qrcodeObj?.pairing;

        if (possibleCode && typeof possibleCode === 'string') {
            console.log("\nAttempting to print QR from 'code' field:");
            qrcode.generate(possibleCode, { small: true });
        } else if (possibleBase64 && typeof possibleBase64 === 'string') {
            console.log("\n--- QR CODE ADAPTER ---");
            console.log("Please copy the Base64 below and use a Base64-to-Image converter:");
            console.log(possibleBase64);
            console.log("-----------------------\n");
        } else {
            console.log("Detailed QR Data Dump:", JSON.stringify(qrData, null, 2));
            console.log("Instance Connected or No QR returned.");
        }

    } catch (error: any) {
        console.error("Setup Failed:", error.message);
        if (error.response) console.error("Response:", error.response.data);
    }
}

setup();
