import { GAME_SDK_VERSION } from './contracts.ts';
import type { GameManifest, ModuleId } from './contracts.ts';

/** Manifests are data-only, so tools and tests can inspect the catalog without React/Phaser. */
export const GAME_REGISTRY: GameManifest[] = [
  {id:'math-quest',label:'Math Quest',description:'Vượt các trạm toán học và thu thập ngôi sao.',runtime:'react',contentKind:'quiz',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'✦',color:'violet'},
  {id:'memory-match',label:'Memory Match',description:'Lật thẻ, ghi nhớ và tìm đúng các cặp kiến thức.',runtime:'react',contentKind:'pairs',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'◈',color:'mint'},
  {id:'sentence-builder',label:'Sentence Builder',description:'Ghép từ thành câu đúng thứ tự với gợi ý khi cần.',runtime:'react',contentKind:'sentences',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'✎',color:'sky'},
  {id:'word-connect',label:'Nối Từ Khám Phá',description:'Kết nối trực tiếp hai cột từ vựng và tri thức tương ứng.',runtime:'react',contentKind:'pairs',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'🔗',color:'teal'},
  {id:'sequence-trail',label:'Bậc Thang Quy Luật',description:'Khám phá và xếp các thẻ theo đúng trật tự quy luật logic.',runtime:'react',contentKind:'sentences',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'📶',color:'amber'},
  {id:'balance-scale',label:'Cân Thăng Bằng',description:'So sánh hai vế toán học bằng chiếc cân đĩa kỳ diệu.',runtime:'react',contentKind:'compare',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'⚖️',color:'emerald'},
  {id:'basket-sort',label:'Phân Loại Vào Giỏ',description:'Phân loại và gom các thẻ kiến thức vào đúng từng giỏ chủ đề.',runtime:'react',contentKind:'categorize',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'🧺',color:'rose'},
  {id:'treasure-flip',label:'Lật Thẻ Kho Báu',description:'Mở các rương kho báu vàng óng để ghép đúng cặp thẻ tri thức.',runtime:'react',contentKind:'pairs',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'💎',color:'amber'},
  {id:'fox-kitchen',label:'Bếp Nhỏ Của Cáo',description:'Cùng Đầu bếp Cáo xếp nguyên liệu vào nồi súp theo đúng trật tự quy luật.',runtime:'react',contentKind:'sentences',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'🍲',color:'orange'},
  {id:'boat-race',label:'Đua Thuyền Rồng',description:'Trả lời nhanh và chính xác trước khi hết giờ để đưa thuyền rồng về đích.',runtime:'react',contentKind:'quiz',version:'0.2.7',sdkVersion:GAME_SDK_VERSION,icon:'⛵',color:'sky'}
];
export const getGame = (id: ModuleId): GameManifest => {
  const manifest = GAME_REGISTRY.find(g => g.id === id);
  if (!manifest) throw new Error(`Module chưa đăng ký: ${id}`);
  return manifest;
};
