/**
 * mascot-dialogue.ts — Bộ lời thoại chuẩn hóa của Cáo đồng hành Bảo An Learning 5.0
 * Quy chuẩn: 02_DINH_HUONG_VA_HE_THONG_THIET_KE.md (Mục 3.6 & C7)
 */

export type MascotMood = 'idle' | 'happy' | 'encourage' | 'streak' | 'done';

export const MASCOT_DIALOGUES: Record<MascotMood, string[]> = {
  idle: [
    'Con cứ suy nghĩ kỹ rồi chọn nhé! 🌟',
    'Bình tĩnh đọc đề, con sẽ tìm ra ngay thôi! 🌿',
    'Cáo luôn ở bên đồng hành cùng con! ✦',
  ],
  happy: [
    'Cậu làm tốt lắm! Thật xuất sắc! 🎉',
    'Tuyệt vời! Con đã trả lời chính xác! ⭐',
    'Trí tuệ nở hoa, tiến thêm một bước nữa rồi! 🌸',
  ],
  encourage: [
    'Sai cũng là một cách học nhé! 🌱',
    'Không sao cả, con thử đọc kỹ lại một lần nữa nhé! 💪',
    'Kiên trì là bí quyết của mọi nhà thám hiểm! 🦊',
  ],
  streak: [
    'Chuỗi đúng liên tiếp thật ấn tượng! 🔥',
    'Phong độ tuyệt đỉnh, tiếp tục phát huy nhé! 🚀',
  ],
  done: [
    'Một chuyến đi thật tuyệt vời! Con đã hoàn thành xuất sắc! 🏆',
    'Hành trình đáng nhớ! Hãy cùng ngắm lại thành tích nhé! ✦',
  ],
};

export function getMascotLine(mood: MascotMood, seed = 0): string {
  const pool = MASCOT_DIALOGUES[mood] || MASCOT_DIALOGUES.idle;
  const index = Math.abs(seed) % pool.length;
  return pool[index];
}
