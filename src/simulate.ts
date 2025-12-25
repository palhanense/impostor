// simulate_game_flow.ts
import { WebhookController } from './controllers/webhook.controller';
import { Request, Response } from 'express';

const controller = new WebhookController();

const mockRes = {
    sendStatus: (code: number) => console.log(`[RES] Status: ${code}`),
    status: (code: number) => ({ send: (body: any) => console.log(`[RES] Body:`, body) })
} as unknown as Response;

function mockReq(message: string, phone: string, name: string) {
    return {
        body: {
            data: {
                key: { remoteJid: `${phone}@s.whatsapp.net` },
                pushName: name,
                message: { conversation: message }
            }
        }
    } as Request;
}

async function runSimulation() {
    console.log("--- Starting Simulation with Pix Flow ---");

    // 1. Emerson starts a game
    console.log("\n[Emerson] Starts Game");
    await controller.handleWebhook(mockReq("Vamos começar uma partida nova", "5511999990001", "Emerson"), mockRes);

    // 1b. Emerson Registration (Assuming he was new)
    console.log("\n[Emerson] Sends Pix");
    await controller.handleWebhook(mockReq("emerson@pix.com", "5511999990001", "Emerson"), mockRes);

    console.log("\n[Emerson] Confirms Pix");
    await controller.handleWebhook(mockReq("Sim, está correto", "5511999990001", "Emerson"), mockRes);

    // 2. Thiago Joins
    console.log("\n[Thiago] Joins");
    await controller.handleWebhook(mockReq("Quero entrar nesse jogo", "5511999990002", "Thiago"), mockRes);

    console.log("\n[Thiago] Sends Social msg (blocked by registration?)");
    await controller.handleWebhook(mockReq("Quem é o impostor?", "5511999990002", "Thiago"), mockRes);

    console.log("\n[Thiago] Sends Pix");
    await controller.handleWebhook(mockReq("11999990002", "5511999990002", "Thiago"), mockRes);

    console.log("\n[Thiago] Confirms");
    await controller.handleWebhook(mockReq("Sim", "5511999990002", "Thiago"), mockRes);
}

runSimulation();
