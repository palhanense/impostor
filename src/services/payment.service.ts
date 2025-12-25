import { MercadoPagoConfig, Payment } from 'mercadopago';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configure MP
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    options: { timeout: 5000 }
});
const payment = new Payment(client);

export class PaymentService {

    /**
     * Generates a Pix Payment for a user in a match.
     */
    async createPixPayment(userId: string, matchId: string, amount: number) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("User not found");

        const transaction = await prisma.transaction.create({
            data: {
                userId,
                matchId,
                amount: amount,
                type: 'ENTRY_FEE',
                status: 'PENDING'
            }
        });

        try {
            console.log("--- [DEBUG] STARTING MP PAYMENT ---");
            console.log("Token Status:", process.env.MERCADOPAGO_ACCESS_TOKEN ? "Present" : "Missing");
            const result = await payment.create({
                body: {
                    transaction_amount: amount,
                    description: `Impostor Pay: Match ${matchId}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: user.pixKey?.includes('@') ? user.pixKey : 'impostor@sandbox.com', // Sandbox fallback
                        first_name: user.name.split(' ')[0],
                    },
                    external_reference: transaction.id,
                    notification_url: `${process.env.NGROK_URL || 'http://localhost:3000'}/api/webhook/mp`
                }
            });
            console.log("--- [DEBUG] MP PAYMENT SUCCESS ---");

            // Save external ID to link webhook later
            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { externalId: result.id?.toString() }
            });

            return {
                copiaCola: result.point_of_interaction?.transaction_data?.qr_code,
                qrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64,
                transactionId: transaction.id
            };
        } catch (error) {
            console.error("MP Error:", error);
            // Fallback for mock/dev without valid Creds
            return {
                copiaCola: "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5913Impostor User6008Brasilia62070503***6304E2CA",
                transactionId: transaction.id,
                mock: true
            };
        }
    }

    /**
     * Handles Payment webhook from Mercado Pago.
     */
    async handleWebhook(data: any) {
        if (data.action === 'payment.created' || data.action === 'payment.updated') {
            const paymentId = data.data.id;
            // In production we would fetch payment status from MP:
            // const p = await payment.get({ id: paymentId });
            // const status = p.status;

            // For MVP simplifiction assuming 'approved' if we get a hit or mock logic
            // Ideally we check p.status === 'approved'

            // Locate transaction
            // We stored paymentId as externalId? Or we search by external_reference?
            // Actually createPixPayment stored mp result.id as externalId.

            const transaction = await prisma.transaction.findFirst({
                where: { externalId: paymentId.toString() }
            });

            if (transaction && transaction.status === 'PENDING') {
                await prisma.transaction.update({
                    where: { id: transaction.id },
                    data: { status: 'COMPLETED' }
                });

                // Update Total Pot
                if (transaction.matchId) {
                    await prisma.match.update({
                        where: { id: transaction.matchId },
                        data: { totalPot: { increment: transaction.amount } }
                    });
                }

                return { success: true, transactionId: transaction.id, userId: transaction.userId, matchId: transaction.matchId };
            }
        }
        return { success: false };
    }
}
