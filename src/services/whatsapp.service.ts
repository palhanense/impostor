import axios from 'axios';

const BASE_URL = process.env.WAHA_API_URL || 'http://localhost:3000';
const API_KEY = process.env.WAHA_API_KEY || '';

/**
 * Minimal client for WAHA (WhatsApp HTTP API).
 *
 * WAHA expects:
 *   POST /api/sendText
 *   Body: { "chatId": "<number@c.us>", "text": "<message>" }
 *   Auth: Bearer token in Authorization header.
 */
export class WhatsAppService {
  async sendText(remoteJid: string, message: string) {
    if (!message) return;

    const chatId = this.formatJid(remoteJid);

    if (!API_KEY) {
      console.log('[WhatsAppService] Skipping sendText: API key missing.');
      return;
    }

    const url = `${BASE_URL.replace(/\\/$/, '')}/api/sendText`;

    try {
      await axios.post(
        url,
        { chatId, text: message },
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );
      console.log(`[WhatsAppService] Sent message to ${chatId}`);
    } catch (error: any) {
      console.error('[WhatsAppService] Failed to send message:', error.message);
      if (error.response) console.error('Response:', error.response.data);
    }
  }

  private formatJid(remoteJid: string) {
    if (!remoteJid) return remoteJid;
    // Normalize to WAHA-compatible chatId (@c.us for individuals, @g.us for groups)
    if (remoteJid.endsWith('@s.whatsapp.net')) {
      return remoteJid.replace('@s.whatsapp.net', '@c.us');
    }
    if (!remoteJid.includes('@')) return `${remoteJid}@c.us`;
    return remoteJid;
  }
}
