export type Profile = { id: string; name: string };
export type Thread = { id: string; user_a: string; user_b: string; created_at: string; peer?: Profile };
export type Message = { id: string; thread_id: string; sender_id: string; kind: 'text' | 'audio' | 'sticker'; body: string | null; audio_path: string | null; sticker_id: number | null; created_at: string };
export type Call = { id: string; thread_id: string; caller_id: string; status: 'ringing' | 'active' | 'ended'; offer: RTCSessionDescriptionInit; answer: RTCSessionDescriptionInit | null; created_at: string };
export const STICKERS = ['Oi, tudo bem?', 'Bom dia!', 'Boa noite!', 'Deus abençoe!', 'Amém!', 'Gratidão!', 'Tamo junto!', 'Bora lá!', 'Combinado!', 'Cheguei!', 'Já te respondo', 'Que alegria!', 'Parabéns!', 'Saudade!', 'Um abraço!', 'Você consegue!', 'Paz e bem!', 'Café primeiro!', 'Foi mal!', 'Até mais!'];
export const EMOJIS = ['😀','😊','😂','🥰','😍','😎','🥳','🤔','😅','🥹','😭','🙏','🙌','👍','👏','🤝','❤️','💙','✨','🎉','🔥','☕','🌻','🕊️'];
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '');
  return !input.trim().startsWith('+') && (digits.length === 10 || digits.length === 11) ? `+55${digits}` : `+${digits}`;
}
export function normalizeIdentifier(input: string) {
  return input.includes('@') ? input.trim().toLowerCase() : normalizePhone(input);
}
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function validPhone(value: string) { return /^\+[1-9]\d{9,14}$/.test(value); }
