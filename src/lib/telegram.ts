export type TelegramSendResult =
  | { sent: true }
  | { sent: false; reason: "not_configured"; message: string }
  | { sent: false; reason: "api_error"; message: string };

/**
 * Send a DM via Telegram Bot API. The recipient must have opened the bot and tapped Start first.
 * https://core.telegram.org/bots/api#sendmessage
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      sent: false,
      reason: "not_configured",
      message: "Set TELEGRAM_BOT_TOKEN in .env (from @BotFather).",
    };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const data = (await res.json()) as { ok?: boolean; description?: string };

  if (!res.ok || !data.ok) {
    return {
      sent: false,
      reason: "api_error",
      message: data.description || res.statusText || "Telegram API error",
    };
  }

  return { sent: true };
}
