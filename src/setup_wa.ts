import axios from 'axios';
import qrcode from 'qrcode-terminal';

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EVOLUTION_API_KEY || 'YOUR_EVOLUTION_KEY';
const INSTANCE_NAME = 'ImpostorBot3';

async function setup() {
    try {
        console.log(`Checking Evolution API at ${EVOLUTION_URL}...`);
        await axios.get(`${EVOLUTION_URL}/`, { headers: { 'apikey': API_KEY } });
        console.log("Evolution API is UP.");

        let qrData: any = null;

        console.log(`Creating instance '${INSTANCE_NAME}'...`);
        try {
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
            if (e.response && e.response.status === 403) {
                console.log("Instance exists. Trying to connect...");
            }
        }

        if (!qrData || (!qrData.base64 && !qrData.qrcode && !qrData.item && !qrData.code)) {
            console.log("Fetching QR Code via Connect...");
            try {
                const connectRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, {
                    headers: { 'apikey': API_KEY }
                });
                qrData = connectRes.data;
            } catch (e: any) {
                console.log("Connect failed (check name/status):", e.message);
            }
        }

        console.log("QR Data received:", JSON.stringify(qrData).substring(0, 150) + "...");

        // Normalized QR Data extraction (Evolution v2 structure varies)
        const possibleBase64 = qrData?.base64 || qrData?.qrcode || qrData?.item?.base64;
        const possibleCode = qrData?.code || qrData?.pairingCode || qrData?.item?.code;

        if (possibleCode) {
            console.log("\nAttempting to print QR from 'code' field:");
            qrcode.generate(possibleCode, { small: true });
        } else if (possibleBase64) {
            console.log("\n--- QR CODE ADAPTER ---");
            console.log("Please copy the Base64 below and use a Base64-to-Image converter:");
            // Remove prefix if present, though cleaner to leave it for converters
            console.log(possibleBase64);
            console.log("-----------------------\n");
        } else {
            console.log("Instance Connected or No QR returned.");
        }

    } catch (error: any) {
        console.error("Setup Failed:", error.message);
        if (error.response) console.error("Response:", error.response.data);
    }
}

setup();
