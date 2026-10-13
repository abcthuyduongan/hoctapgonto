import type { ContentPack, PairItem, QuizItem } from './contracts';

const now = '2026-10-12T00:00:00.000Z';
const q = (id: string, prompt: string, options: [string,string,string,string], correctIndex: 0|1|2|3, explanation: string): QuizItem => ({
  kind: 'multiple-choice', id, objectiveId:'MATH3.NUMBER', prompt, options, correctIndex, explanation
});
const p = (id: string, left: string, right: string, objectiveId: string): PairItem => ({kind:'pair',id,left,right,objectiveId});

/** Sentence Builder: built-in demo, not a textbook-approved assessment set. */
export const SENTENCE_PACKS: ContentPack[] = [
  {id:'english3-sentences',version:1,title:'Tiếng Anh · Ghép câu đơn giản',subject:'english',grade:3,kind:'sentences',source:'builtin',publishedAt:now,
   items:[
     {kind:'sentence',id:'sen-1',objectiveId:'ENG3.SENTENCES',prompt:'Sắp xếp thành câu nói về bản thân.',words:['I','am','a','student.'],hint:'Bắt đầu bằng chủ ngữ I.'},
     {kind:'sentence',id:'sen-2',objectiveId:'ENG3.SENTENCES',prompt:'Sắp xếp câu giới thiệu người thân.',words:['This','is','my','mother.'],hint:'Bắt đầu bằng This.'},
     {kind:'sentence',id:'sen-3',objectiveId:'ENG3.SENTENCES',prompt:'Sắp xếp câu nói về sở thích.',words:['I','like','playing','chess.'],hint:'Sau I là động từ like.'},
     {kind:'sentence',id:'sen-4',objectiveId:'ENG3.SENTENCES',prompt:'Sắp xếp câu nói về ngôi nhà.',words:['My','house','is','small.'],hint:'Bắt đầu bằng My house.'},
     {kind:'sentence',id:'sen-5',objectiveId:'ENG3.SENTENCES',prompt:'Sắp xếp câu hỏi về tên.',words:['What','is','your','name?'],hint:'Từ để hỏi đứng đầu câu.'},
     {kind:'sentence',id:'sen-6',objectiveId:'ENG3.SENTENCES',prompt:'Sắp xếp câu kể về việc học.',words:['We','go','to','school.'],hint:'Bắt đầu bằng We.'}
   ]}
];

export const BUILTIN_PACKS: ContentPack[] = [
  {id:'math3-adventure',version:1,title:'Toán 3 · Phép tính vui',subject:'math',grade:3,kind:'quiz',source:'builtin',publishedAt:now,
    items:[
      q('math-1','24 + 18 = ?', ['42','41','32','43'],0,'24 + 18 = 42 (cộng hàng đơn vị rồi đến hàng chục).'),
      q('math-2','63 − 27 = ?', ['46','36','34','38'],1,'63 − 27 = 36. Có thể kiểm tra: 36 + 27 = 63.'),
      q('math-3','7 × 6 = ?', ['36','48','42','40'],2,'7 × 6 = 42.'),
      q('math-4','56 : 8 = ?', ['8','6','9','7'],3,'56 : 8 = 7, vì 7 × 8 = 56.'),
      q('math-5','Số liền sau của 399 là số nào?', ['400','398','409','390'],0,'Số liền sau của 399 là 400.'),
      q('math-6','35 + 26 = ?', ['51','61','62','71'],1,'35 + 26 = 61.'),
      q('math-7','9 × 4 = ?', ['32','45','36','27'],2,'9 × 4 = 36.'),
      q('math-8','72 : 9 = ?', ['7','9','6','8'],3,'72 : 9 = 8.')
    ]},
  {id:'english3-family',version:1,title:'Tiếng Anh · Gia đình',subject:'english',grade:3,kind:'pairs',source:'builtin',publishedAt:now,
    items:[p('en-1','mother','mẹ','ENG3.FAMILY'),p('en-2','father','bố','ENG3.FAMILY'),p('en-3','sister','chị / em gái','ENG3.FAMILY'),p('en-4','brother','anh / em trai','ENG3.FAMILY'),p('en-5','grandmother','bà','ENG3.FAMILY'),p('en-6','grandfather','ông','ENG3.FAMILY')]},
  {id:'math3-equations',version:1,title:'Toán · Phép nhân',subject:'math',grade:3,kind:'pairs',source:'builtin',publishedAt:now,
    items:[p('mul-1','3 × 4','12','MATH3.MULTIPLY'),p('mul-2','5 × 6','30','MATH3.MULTIPLY'),p('mul-3','7 × 3','21','MATH3.MULTIPLY'),p('mul-4','8 × 4','32','MATH3.MULTIPLY'),p('mul-5','9 × 5','45','MATH3.MULTIPLY'),p('mul-6','6 × 7','42','MATH3.MULTIPLY')]},
  {id:'vietnamese3-vocab',version:1,title:'Tiếng Việt · Từ trái nghĩa',subject:'vietnamese',grade:3,kind:'pairs',source:'builtin',publishedAt:now,
    items:[p('vi-1','cao','thấp','VI3.ANTONYM'),p('vi-2','nhanh','chậm','VI3.ANTONYM'),p('vi-3','sáng','tối','VI3.ANTONYM'),p('vi-4','nóng','lạnh','VI3.ANTONYM'),p('vi-5','vui','buồn','VI3.ANTONYM'),p('vi-6','rộng','hẹp','VI3.ANTONYM')]},
  ...SENTENCE_PACKS
];

