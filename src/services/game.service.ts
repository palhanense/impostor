import { PrismaClient, Match, User, Participant } from '@prisma/client';
import { GeminiService } from './gemini.service';
import { PaymentService } from './payment.service';

const prisma = new PrismaClient();
const paymentService = new PaymentService();

export class GameService {
    constructor(private geminiService: GeminiService) { }

    async findActiveMatchForUser(phone: string): Promise<Match | null> {
        const participant = await prisma.participant.findFirst({
            where: {
                user: { phone },
                match: {
                    status: { in: ['WAITING_PAYMENT', 'ACTIVE', 'VOTING'] }
                }
            },
            include: { match: true }
        });
        return participant?.match || null;
    }

    async findParticipant(phone: string): Promise<Participant | null> {
        return prisma.participant.findFirst({
            where: {
                user: { phone },
                match: { status: { in: ['WAITING_PAYMENT', 'ACTIVE'] } }
            }
        });
    }

    async findOpenMatch(): Promise<Match | null> {
        return prisma.match.findFirst({
            where: { status: 'WAITING_PAYMENT' }
        });
    }

    generateCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async createMatch(creatorPhone: string, creatorName: string): Promise<Match> {
        const existing = await this.findActiveMatchForUser(creatorPhone);
        if (existing) return existing;

        let user = await prisma.user.findUnique({ where: { phone: creatorPhone } });
        if (!user) {
            user = await prisma.user.create({ data: { phone: creatorPhone, name: creatorName } });
        }

        const code = this.generateCode();

        const match = await prisma.match.create({
            data: {
                status: 'WAITING_PAYMENT',
                totalPot: 0,
                code: code,
                participants: {
                    create: {
                        userId: user.id,
                        status: 'READY'
                    }
                }
            }
        });

        return match;
    }

    async joinMatchByCode(code: string, userPhone: string, userName: string) {
        const match = await prisma.match.findUnique({
            where: { code: code.toUpperCase() }
        });

        if (!match) {
            throw new Error("Match code not found");
        }

        if (match.status !== 'WAITING_PAYMENT') {
            throw new Error("Match already started or finished");
        }

        return this.joinMatch(match.id, userPhone, userName);
    }

    async joinMatch(matchId: string, userPhone: string, userName: string) {
        let user = await prisma.user.findUnique({ where: { phone: userPhone } });
        if (!user) {
            user = await prisma.user.create({ data: { phone: userPhone, name: userName } });
        }

        const existingEntry = await prisma.participant.findUnique({
            where: { matchId_userId: { matchId, userId: user.id } }
        });

        if (existingEntry) return existingEntry;

        // Check if user already has a Pix Key from previous games?
        const initialStatus = user.pixKey ? 'READY' : 'PENDING_PIX';

        // If READY (had key), trigger Payment Generation immediately? 
        // Or wait for specific "Pay" command? Logic: Auto-trigger payment if ready.
        const p = await prisma.participant.create({
            data: {
                matchId,
                userId: user.id,
                status: initialStatus
            }
        });

        // If they are READY (have key), we should return info to Controller to trigger payment logic
        return p;
    }

    async submitPixKey(userPhone: string, matchId: string, key: string) {
        const user = await prisma.user.findUnique({ where: { phone: userPhone } });
        if (!user) throw new Error("User not found");

        return prisma.participant.update({
            where: { matchId_userId: { matchId, userId: user.id } },
            data: {
                tempData: key,
                status: 'CONFIRMING_PIX'
            }
        });
    }

    async confirmPixKey(userPhone: string, matchId: string, confirmed: boolean) {
        const user = await prisma.user.findUnique({ where: { phone: userPhone } });
        if (!user) throw new Error("User not found");
        const userId = user.id;

        if (confirmed) {
            const participant = await prisma.participant.findUnique({
                where: { matchId_userId: { matchId, userId } }
            });

            if (!participant || !participant.tempData) throw new Error("No data to confirm");

            await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: { pixKey: participant.tempData }
                }),
                prisma.participant.update({
                    where: { id: participant.id },
                    data: { status: 'READY', tempData: null }
                })
            ]);

            // Generate Payment
            const payment = await paymentService.createPixPayment(userId, matchId, 15.00); // R$ 15.00 Entry Fee
            return { success: true, payment };
        } else {
            await prisma.participant.update({
                where: { matchId_userId: { matchId, userId } },
                data: { status: 'PENDING_PIX', tempData: null }
            });
            return { success: false };
        }
    }

    // Also needed: Logic for user who JOINED as READY to get payment
    async generatePaymentForReadyPlayer(userPhone: string, matchId: string) {
        const user = await prisma.user.findUnique({ where: { phone: userPhone } });
        if (!user) throw new Error("User not found");

        return paymentService.createPixPayment(user.id, matchId, 15.00);
    }

    async startGame(matchId: string) {
        // START LOGIC ONLY IF EVERYONE PAID? 
        // For now assuming we start manually regardless of payment for MVP testing
        const participants = await prisma.participant.findMany({
            where: { matchId, status: 'READY' }
        });

        if (participants.length < 3) {
            throw new Error("Not enough players (need 3 READY)");
        }

        const impostorIndex = Math.floor(Math.random() * participants.length);
        const impostor = participants[impostorIndex];

        const words = ["Banana", "Avião", "Praia", "Computador", "Futebol", "Cerveja", "Brasil", "Churrasco"];
        const secretWord = words[Math.floor(Math.random() * words.length)];

        await prisma.$transaction([
            prisma.participant.update({
                where: { id: impostor.id },
                data: { role: 'IMPOSTOR' }
            }),
            prisma.match.update({
                where: { id: matchId },
                data: {
                    status: 'ACTIVE',
                    secretWord,
                    impostorId: impostor.userId
                }
            })
        ]);

        return { secretWord, impostorId: impostor.userId, count: participants.length };
    }

    async processGuess(matchId: string, userId: string, guess: string) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match || !match.secretWord) return { success: false, message: "No active game." };

        if (match.status !== 'ACTIVE' && match.status !== 'VOTING') {
            return { success: false, message: "Game not in progress." };
        }

        const normalizedGuess = guess.trim().toLowerCase();
        const normalizedSecret = match.secretWord.trim().toLowerCase();

        if (normalizedGuess === normalizedSecret) {
            await prisma.match.update({
                where: { id: matchId },
                data: { status: 'FINISHED' }
            });
            return { success: true, winner: userId, type: 'INSTANT_WIN' };
        } else {
            return { success: false, message: "Errou feio, errou rude!" };
        }
    }

    async processVote(matchId: string, voterId: string, targetName: string) {
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: { participants: { include: { user: true } } }
        });

        if (!match) return;

        const target = match.participants.find(p => p.user.name.toLowerCase().includes(targetName.toLowerCase()));

        if (!target) return { success: false, message: "Player not found" };

        await prisma.bet.create({
            data: {
                matchId,
                userId: voterId,
                targetId: target.userId
            }
        });

        return { success: true, target: target.user.name };
    }
}
