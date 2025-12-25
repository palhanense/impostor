import axios from 'axios';

const EVOLUTION_URL = 'http://localhost:8080';
const API_KEY = 'YOUR_EVOLUTION_KEY';
const INSTANCE_NAME = 'impostor-pay';

async function check() {
    try {
        const res = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, {
            headers: { 'apikey': API_KEY }
        });
        // const instance = res.data.find((i: any) => i.instance.instanceName === INSTANCE_NAME);
        console.log("Data:", JSON.stringify(res.data, null, 2));
        // console.log("Status:", instance ? instance.instance.status : "Not Found");
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}
check();
