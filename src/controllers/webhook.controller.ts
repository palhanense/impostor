import { Request, Response } from 'express';
import { GeminiService } from '../services/gemini.service';
import { GameService } from '../services/game.service';

const geminiService = new GeminiService();
const gameService = new GameService(geminiService);

export class WebhookController {
    async handleWebhook(req: Request, res: Response) {
        try {
            const { data } = req.body;

            if (!data || !data.key || !data.key.remoteJid) {
                return res.sendStatus(200);
            }

            const messageContent = data.message?.conversation || data.message?.extendedTextMessage?.text;
            const remoteJid = data.key.remoteJid;
            const senderName = data.pushName || "Unknown";
            const senderPhone = remoteJid.split('@')[0];

            if (!messageContent) return res.sendStatus(200);

            console.log(`Received from ${senderName} (${senderPhone}): ${messageContent}`);

            const activeMatch = await gameService.findActiveMatchForUser(senderPhone);

            // Get Participant Status if active
            let participantStatus = 'UNKNOWN';
            let participantData = null;
            if (activeMatch) {
                const p = await gameService.findParticipant(senderPhone);
                participantStatus = p?.status || 'UNKNOWN';
                participantData = p;
            }

            const openMatch = !activeMatch ? await gameService.findOpenMatch() : null;

            console.log(`[DEBUG] Phone: ${senderPhone}, Status: ${participantStatus}, ActiveMatch: ${activeMatch?.id}`);

            let context = "User is not in an active game.";
            if (activeMatch) {
                if (participantStatus === 'PENDING_PIX') {
                    context = `User joined but needs to provide Pix Key. Ask for it.`;
                } else if (participantStatus === 'CONFIRMING_PIX') {
                    context = `Wait for Pix Confirmation. User sent: ${participantData?.tempData}. Ask YES/NO.`;
                } else {
                    context = `User is in match ${activeMatch.id} (Code: ${activeMatch.code}). Status: ${activeMatch.status}.`;
                }
            } else if (openMatch) {
                context = `There is a match waiting.`;
            }

            const intent = await geminiService.classifyIntent(messageContent, context);
            console.log("Intent:", intent);

            let narration = "";

            // 1. REGISTRATION INTERCEPTOR
            if (activeMatch && participantStatus === 'PENDING_PIX') {
                if (intent.type === 'DATA_ENTRY' && intent.data) {
                    await gameService.submitPixKey(senderPhone, activeMatch.id, intent.data);
                    narration = await geminiService.narrate(context, `Received ${intent.data}. Asking confirmation.`);
                } else {
                    narration = "Welcome! Before we play, I need your Pix Key. Please send it here.";
                }
            }
            else if (activeMatch && participantStatus === 'CONFIRMING_PIX') {
                if (intent.type === 'CONFIRMATION') {
                    const result = await gameService.confirmPixKey(senderPhone, activeMatch.id, intent.confirmed || false);
                    if (result.success && result.payment) {
                        narration = `Pix Confirmed! Here is the code to calculate your entry fee (R$ 15.00):\n\n${result.payment.copiaCola}\n\nPay to start!`;
                    } else if (result.success) {
                        // Fallback if no payment obj
                        narration = "Pix Confirmed! You are officially in the game.";
                    } else {
                        narration = "Ok, let's try again. What is your Pix Key?";
                    }
                } else {
                    narration = `Is this correct: ${participantData?.tempData}? (Sim/Não)`;
                }
            }
            else if (intent.type === 'NEW_GAME') {
                const match = await gameService.createMatch(senderPhone, senderName);
                narration = await geminiService.narrate(context, `New match started by ${senderName}. Code: ${match.code}. Send this code to friends!`);
            }
            else if (intent.type === 'GAME_ACTION') {
                if (intent.action === 'JOIN') {
                    try {
                        let p;
                        if (intent.target) {
                            p = await gameService.joinMatchByCode(intent.target, senderPhone, senderName);
                        } else if (openMatch) {
                            p = await gameService.joinMatch(openMatch.id, senderPhone, senderName);
                        } else {
                            narration = "A code is required to join.";
                        }

                        if (p) {
                            if (p.status === 'PENDING_PIX') narration = "Welcome! I need your Pix Key to proceed. Send it now.";
                            else if (p.status === 'READY') {
                                const payment = await gameService.generatePaymentForReadyPlayer(senderPhone, p.matchId);
                                narration = `Welcome back! Here is your payment code (R$ 15.00):\n\n${payment.copiaCola}`;
                            }
                        }
                    } catch (e: any) {
                        narration = "Could not join: " + e.message;
                    }
                }
                // ACTION LOGIC ... (Rest is same)
                else if (activeMatch) {
                    if (intent.action === 'VOTE' && intent.target) {
                        const result = await gameService.processVote(activeMatch.id, senderPhone, intent.target);
                        narration = result?.success
                            ? await geminiService.narrate(context, `${senderName} voted for ${intent.target}`)
                            : "Vote failed: " + result?.message;
                    } else if (intent.action === 'GUESS_WORD' && intent.target) {
                        const result = await gameService.processGuess(activeMatch.id, senderPhone, intent.target);
                        if (result.success) {
                            narration = await geminiService.narrate(context, `${senderName} KICKED THE BUCKET AND WON! Word was ${intent.target}`);
                        } else {
                            narration = await geminiService.narrate(context, `${senderName} guessed wrong: ${intent.target}`);
                        }
                    }
                } else {
                    narration = "No active game to perform this action.";
                }
            } else {
                narration = await geminiService.narrate(context, `User ${senderName} said: "${messageContent}"`);
            }

            console.log("Response:", narration);

            return res.status(200).send({ status: 'PROCESSED' });
        } catch (error) {
            console.error("Webhook Error:", error);
            return res.sendStatus(500);
        }
    }
}
