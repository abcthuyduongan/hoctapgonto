// src/core/contest-matrix.ts
// Ma trận đề và quy chế thi thử Violympic & IOE (Tuần 7 - Cổng C7)

export interface ContestPreset {
  id: string;
  contest: 'violympic' | 'ioe';
  title: string;
  subject: 'math' | 'english';
  grade: number;
  durationSeconds: number;
  totalQuestions: number;
  pointsPerCorrect: number;
  maxScore: number;
  passPercent: number;
  disclaimer: string;
  description: string;
}

export interface ContestQuestionItem {
  id: string;
  kind: 'choice' | 'fill';
  prompt: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  objectiveId?: string;
}

export interface SanitizedContestItem {
  id: string;
  kind: 'choice' | 'fill';
  prompt: string;
  options?: string[];
  objectiveId?: string;
}

export interface ContestMistake {
  itemId: string;
  prompt: string;
  studentAnswer: string | number | null;
  correctAnswer: string | number;
  explanation: string;
}

export interface ContestResult {
  sessionId: string;
  presetId: string;
  status: 'submitted' | 'timeout';
  finishReason: 'submitted' | 'timeout';
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  correctCount: number;
  totalItems: number;
  elapsedMs: number;
  mistakes: ContestMistake[];
  readyForExam: boolean;
  badgeAwarded?: boolean;
}

export const CONTEST_DISCLAIMER = 'Đề luyện theo dạng, không phải đề chính thức';

export const CONTEST_PRESETS: Record<string, ContestPreset> = {
  'violympic-math-g3': {
    id: 'violympic-math-g3',
    contest: 'violympic',
    title: 'Thi thử Violympic Toán Lớp 3',
    subject: 'math',
    grade: 3,
    durationSeconds: 1200, // 20 phút
    totalQuestions: 15,
    pointsPerCorrect: 10,
    maxScore: 150,
    passPercent: 80,
    disclaimer: CONTEST_DISCLAIMER,
    description: 'Bộ đề luyện thi Violympic Toán lớp 3 theo cấu trúc chuẩn: thời gian 20 phút, 15 câu trắc nghiệm và điền số, không dùng gợi ý.'
  },
  'ioe-english-g3': {
    id: 'ioe-english-g3',
    contest: 'ioe',
    title: 'Thi thử IOE Tiếng Anh Lớp 3',
    subject: 'english',
    grade: 3,
    durationSeconds: 1200, // 20 phút
    totalQuestions: 15,
    pointsPerCorrect: 10,
    maxScore: 150,
    passPercent: 80,
    disclaimer: CONTEST_DISCLAIMER,
    description: 'Bộ đề luyện thi IOE Tiếng Anh lớp 3 theo cấu trúc chuẩn: thời gian 20 phút, 15 câu chọn đáp án đúng và hoàn thành từ/câu.'
  }
};

export const CONTESTANT_BADGE = {
  id: 'contestant',
  title: 'Thí sinh',
  description: 'Hoàn thành lượt thi thử Violympic hoặc IOE đầu tiên.',
  difficulty: 'easy',
  category: 'persistence',
  icon: 'award',
  targetCount: 1,
  conditionDescription: 'Hoàn thành 1 bài thi thử Violympic hoặc IOE.'
};

/**
 * Loại bỏ đáp án đúng và lời giải trước khi gửi về trình duyệt học sinh trong lúc đang thi.
 */
export function sanitizeContestItem(item: ContestQuestionItem): SanitizedContestItem {
  const { id, kind, prompt, options, objectiveId } = item;
  return {
    id,
    kind,
    prompt,
    ...(options ? { options: [...options] } : {}),
    ...(objectiveId ? { objectiveId } : {})
  };
}

/**
 * Ngân hàng câu hỏi chuẩn Violympic Toán Lớp 3 (20 câu phong phú theo ma trận chuẩn)
 */
export const VIOLYMPIC_MATH_POOL: ContestQuestionItem[] = [
  {
    id: 'vm3_01',
    kind: 'choice',
    prompt: 'Số gồm 5 trăm, 3 chục và 8 đơn vị được viết là:',
    options: ['538', '583', '358', '835'],
    correctAnswer: '538',
    explanation: '5 trăm + 3 chục + 8 đơn vị = 500 + 30 + 8 = 538.'
  },
  {
    id: 'vm3_02',
    kind: 'choice',
    prompt: 'Tính: 48 : 6 + 25 = ?',
    options: ['33', '31', '35', '29'],
    correctAnswer: '33',
    explanation: 'Thực hiện chia trước: 48 : 6 = 8. Sau đó cộng: 8 + 25 = 33.'
  },
  {
    id: 'vm3_03',
    kind: 'fill',
    prompt: 'Tìm x biết: x × 7 = 56. Giá trị của x là:',
    correctAnswer: '8',
    explanation: 'x = 56 : 7 = 8.'
  },
  {
    id: 'vm3_04',
    kind: 'choice',
    prompt: 'Một hình vuông có cạnh dài 9cm. Chu vi của hình vuông đó là:',
    options: ['36cm', '18cm', '81cm', '27cm'],
    correctAnswer: '36cm',
    explanation: 'Chu vi hình vuông = cạnh × 4 = 9 × 4 = 36 (cm).'
  },
  {
    id: 'vm3_05',
    kind: 'choice',
    prompt: 'Mẹ mua 35 quả cam, mẹ đem biếu bà 1/5 số cam đó. Hỏi mẹ đã biếu bà bao nhiêu quả cam?',
    options: ['7 quả', '5 quả', '6 quả', '8 quả'],
    correctAnswer: '7 quả',
    explanation: 'Số cam biếu bà là: 35 : 5 = 7 (quả).'
  },
  {
    id: 'vm3_06',
    kind: 'fill',
    prompt: 'Điền số thích hợp: 3m 4dm = ... dm.',
    correctAnswer: '34',
    explanation: '3m = 30dm; 30dm + 4dm = 34dm.'
  },
  {
    id: 'vm3_07',
    kind: 'choice',
    prompt: 'Tích của hai số là 42. Nếu giữ nguyên một thừa số và giảm thừa số kia đi 2 lần thì tích mới là:',
    options: ['21', '84', '20', '40'],
    correctAnswer: '21',
    explanation: 'Khi giảm một thừa số đi 2 lần thì tích cũng giảm đi 2 lần: 42 : 2 = 21.'
  },
  {
    id: 'vm3_08',
    kind: 'choice',
    prompt: 'Trong các phép chia sau, phép chia nào có số dư lớn nhất?',
    options: ['29 : 6', '35 : 4', '43 : 5', '51 : 7'],
    correctAnswer: '29 : 6',
    explanation: '29 : 6 = 4 (dư 5). 35 : 4 = 8 (dư 3). 43 : 5 = 8 (dư 3). 51 : 7 = 7 (dư 2). Số dư lớn nhất là 5.'
  },
  {
    id: 'vm3_09',
    kind: 'fill',
    prompt: 'Một lớp học có 32 học sinh xếp đều thành 4 hàng. Hỏi 3 hàng có bao nhiêu học sinh?',
    correctAnswer: '24',
    explanation: 'Mỗi hàng có: 32 : 4 = 8 học sinh. 3 hàng có: 8 × 3 = 24 học sinh.'
  },
  {
    id: 'vm3_10',
    kind: 'choice',
    prompt: 'Số chẵn lớn nhất có 3 chữ số khác nhau là:',
    options: ['986', '998', '987', '984'],
    correctAnswer: '986',
    explanation: 'Chữ số hàng trăm lớn nhất là 9, hàng chục khác nhau là 8, hàng đơn vị chẵn khác nhau lớn nhất là 6 -> 986.'
  },
  {
    id: 'vm3_11',
    kind: 'fill',
    prompt: 'Tìm số bị chia trong phép chia có số chia là 8, thương là 9 và số dư là 5. Số bị chia là:',
    correctAnswer: '77',
    explanation: 'Số bị chia = thương × số chia + số dư = 9 × 8 + 5 = 72 + 5 = 77.'
  },
  {
    id: 'vm3_12',
    kind: 'choice',
    prompt: 'Đồng hồ chỉ mấy giờ khi kim ngắn chỉ giữa số 4 và số 5, kim dài chỉ số 6?',
    options: ['4 giờ 30 phút', '5 giờ 30 phút', '4 giờ 6 phút', '5 giờ 6 phút'],
    correctAnswer: '4 giờ 30 phút',
    explanation: 'Kim ngắn qua số 4 là 4 giờ, kim dài chỉ số 6 là 30 phút.'
  },
  {
    id: 'vm3_13',
    kind: 'choice',
    prompt: 'Một hình chữ nhật có chiều dài 12cm, chiều rộng bằng 1/3 chiều dài. Chu vi hình chữ nhật đó là:',
    options: ['32cm', '16cm', '36cm', '48cm'],
    correctAnswer: '32cm',
    explanation: 'Chiều rộng: 12 : 3 = 4cm. Chu vi = (12 + 4) × 2 = 32cm.'
  },
  {
    id: 'vm3_14',
    kind: 'fill',
    prompt: 'Hiện nay bố 36 tuổi, con 6 tuổi. Hỏi tuổi bố gấp mấy lần tuổi con?',
    correctAnswer: '6',
    explanation: 'Tuổi bố gấp tuổi con số lần là: 36 : 6 = 6 (lần).'
  },
  {
    id: 'vm3_15',
    kind: 'choice',
    prompt: 'Ngày 28 tháng 4 là thứ Năm. Hỏi ngày 1 tháng 5 cùng năm đó là thứ mấy?',
    options: ['Chủ nhật', 'Thứ Bảy', 'Thứ Sáu', 'Thứ Hai'],
    correctAnswer: 'Chủ nhật',
    explanation: 'Tháng 4 có 30 ngày: 28/4 là thứ Năm, 29/4 là thứ Sáu, 30/4 là thứ Bảy, 1/5 là Chủ nhật.'
  },
  {
    id: 'vm3_16',
    kind: 'fill',
    prompt: 'Có 4 bao gạo cân nặng 160kg. Hỏi 7 bao gạo như thế cân nặng bao nhiêu ki-lô-gam?',
    correctAnswer: '280',
    explanation: 'Mỗi bao gạo nặng: 160 : 4 = 40 (kg). 7 bao nặng: 40 × 7 = 280 (kg).'
  },
  {
    id: 'vm3_17',
    kind: 'choice',
    prompt: 'Giá trị biểu thức: 125 + 75 : 5 là:',
    options: ['140', '40', '150', '135'],
    correctAnswer: '140',
    explanation: '75 : 5 = 15; 125 + 15 = 140.'
  },
  {
    id: 'vm3_18',
    kind: 'fill',
    prompt: 'Thùng thứ nhất có 45 lít dầu, thùng thứ hai có số lít dầu giảm đi 3 lần so với thùng thứ nhất. Cả hai thùng có ... lít dầu.',
    correctAnswer: '60',
    explanation: 'Thùng 2 có: 45 : 3 = 15 (l). Cả hai thùng có: 45 + 15 = 60 (l).'
  },
  {
    id: 'vm3_19',
    kind: 'choice',
    prompt: 'Tìm số nhỏ nhất có 3 chữ số mà tổng các chữ số bằng 10:',
    options: ['109', '118', '190', '127'],
    correctAnswer: '109',
    explanation: 'Để số nhỏ nhất, chữ số hàng trăm là 1, hàng chục nhỏ nhất là 0, hàng đơn vị là 10 - 1 - 0 = 9 -> 109.'
  },
  {
    id: 'vm3_20',
    kind: 'fill',
    prompt: 'Bao An có 54 viên bi, Bảo An cho bạn 1/6 số bi của mình. Hỏi Bảo An còn lại bao nhiêu viên bi?',
    correctAnswer: '45',
    explanation: 'Số bi cho bạn: 54 : 6 = 9 (viên). Số bi còn lại: 54 - 9 = 45 (viên).'
  }
];

/**
 * Ngân hàng câu hỏi chuẩn IOE Tiếng Anh Lớp 3 (20 câu phong phú theo ma trận chuẩn)
 */
export const IOE_ENGLISH_POOL: ContestQuestionItem[] = [
  {
    id: 'ioe3_01',
    kind: 'choice',
    prompt: 'Choose the correct answer: "What is your name?" - "______ name is Nam."',
    options: ['My', 'Your', 'His', 'Her'],
    correctAnswer: 'My',
    explanation: 'Câu hỏi về tên của bạn thì trả lời là "My name is...".'
  },
  {
    id: 'ioe3_02',
    kind: 'choice',
    prompt: 'Fill in the blank: "How are you today?" - "I am ______, thank you."',
    options: ['fine', 'nine', 'five', 'name'],
    correctAnswer: 'fine',
    explanation: 'Mẫu câu quen thuộc: "I am fine, thank you."'
  },
  {
    id: 'ioe3_03',
    kind: 'fill',
    prompt: 'Complete the word: "This is my s_h_ol." (school)',
    correctAnswer: 'school',
    explanation: 'Từ chỉ trường học viết đúng là: school.'
  },
  {
    id: 'ioe3_04',
    kind: 'choice',
    prompt: 'Choose the correct question: "______ is that?" - "It is my pen."',
    options: ['What', 'Who', 'How', 'Where'],
    correctAnswer: 'What',
    explanation: 'Hỏi đồ vật dùng đại từ nghi vấn "What".'
  },
  {
    id: 'ioe3_05',
    kind: 'choice',
    prompt: '"Is this your pencil case?" - "Yes, ______."',
    options: ['it is', 'is it', 'it isn\'t', 'it does'],
    correctAnswer: 'it is',
    explanation: 'Câu trả lời khẳng định cho câu hỏi "Is this...?" là "Yes, it is."'
  },
  {
    id: 'ioe3_06',
    kind: 'fill',
    prompt: 'Complete the sentence with one word: "Stand ______, please!" (up)',
    correctAnswer: 'up',
    explanation: 'Cụm khẩu lệnh: "Stand up, please!" (Mời đứng lên).'
  },
  {
    id: 'ioe3_07',
    kind: 'choice',
    prompt: 'How many apples are there? "There are ______ apples."',
    options: ['three', 'tree', 'tea', 'there'],
    correctAnswer: 'three',
    explanation: 'Số đếm 3 trong tiếng Anh là "three".'
  },
  {
    id: 'ioe3_08',
    kind: 'choice',
    prompt: '"What color is your ruler?" - "It is ______."',
    options: ['blue', 'book', 'boy', 'bag'],
    correctAnswer: 'blue',
    explanation: '"blue" là từ chỉ màu sắc (màu xanh dương).'
  },
  {
    id: 'ioe3_09',
    kind: 'fill',
    prompt: 'Fill in the missing letters: "May I c_m_ in?" (come)',
    correctAnswer: 'come',
    explanation: 'Mẫu câu xin phép: "May I come in?" (Em có thể vào lớp không?).'
  },
  {
    id: 'ioe3_10',
    kind: 'choice',
    prompt: 'Which word is the odd one out (chọn từ khác loại)?',
    options: ['ruler', 'eraser', 'pencil', 'yellow'],
    correctAnswer: 'yellow',
    explanation: 'ruler, eraser, pencil là đồ dùng học tập; yellow là màu sắc.'
  },
  {
    id: 'ioe3_11',
    kind: 'choice',
    prompt: '"How old are you?" - "I am ______ years old."',
    options: ['eight', 'white', 'night', 'right'],
    correctAnswer: 'eight',
    explanation: 'Chỉ số tuổi học sinh lớp 3: "eight" (8 tuổi).'
  },
  {
    id: 'ioe3_12',
    kind: 'fill',
    prompt: 'Complete the word: "Open your b_ _k, please!" (book)',
    correctAnswer: 'book',
    explanation: 'Mẫu câu: "Open your book, please!" (Mở sách ra).'
  },
  {
    id: 'ioe3_13',
    kind: 'choice',
    prompt: '"Who is that?" - "______ is my teacher, Ms. Hoa."',
    options: ['She', 'He', 'It', 'They'],
    correctAnswer: 'She',
    explanation: 'Ms. Hoa là cô giáo (nữ), dùng đại từ "She".'
  },
  {
    id: 'ioe3_14',
    kind: 'choice',
    prompt: 'Rearrange letters to make a word: "f - r - i - e - n - d"',
    options: ['friend', 'freind', 'frendi', 'findre'],
    correctAnswer: 'friend',
    explanation: 'Từ đúng chỉ bạn bè là: friend.'
  },
  {
    id: 'ioe3_15',
    kind: 'fill',
    prompt: 'Fill in the blank: "Nice to m_ _t you." (meet)',
    correctAnswer: 'meet',
    explanation: 'Mẫu câu chào hỏi thân mật: "Nice to meet you."'
  },
  {
    id: 'ioe3_16',
    kind: 'choice',
    prompt: '"Are those your notebooks?" - "No, ______."',
    options: ['they aren\'t', 'they are', 'it isn\'t', 'they don\'t'],
    correctAnswer: 'they aren\'t',
    explanation: 'Phủ định với "Are those...?" là "No, they aren\'t."'
  },
  {
    id: 'ioe3_17',
    kind: 'choice',
    prompt: 'What is the opposite of "big"?',
    options: ['small', 'large', 'new', 'old'],
    correctAnswer: 'small',
    explanation: 'Từ trái nghĩa với "big" (to/lớn) là "small" (nhỏ).'
  },
  {
    id: 'ioe3_18',
    kind: 'fill',
    prompt: 'Fill in the blank: "Don\'t t_lk in class, please!" (talk)',
    correctAnswer: 'talk',
    explanation: 'Khẩu lệnh nhắc nhở: "Don\'t talk in class, please!" (Xin đừng nói chuyện trong lớp).'
  },
  {
    id: 'ioe3_19',
    kind: 'choice',
    prompt: '"Is your school library big?" - "Yes, it is very ______."',
    options: ['large', 'short', 'sad', 'angry'],
    correctAnswer: 'large',
    explanation: '"large" đồng nghĩa với "big", phù hợp miêu tả thư viện trường.'
  },
  {
    id: 'ioe3_20',
    kind: 'fill',
    prompt: 'Complete the sentence: "See you a_ain!" (again)',
    correctAnswer: 'again',
    explanation: 'Mẫu câu tạm biệt: "See you again!" (Hẹn gặp lại con!).'
  }
];

/**
 * Đánh giá kết quả bài thi thử.
 */
export function evaluateContestSubmission(
  items: ContestQuestionItem[],
  answers: Record<string, any>,
  preset: ContestPreset,
  elapsedMs: number,
  finishReason: 'submitted' | 'timeout'
): Omit<ContestResult, 'sessionId' | 'readyForExam' | 'badgeAwarded'> {
  let correctCount = 0;
  const mistakes: ContestMistake[] = [];

  for (const item of items) {
    const rawAnswer = answers[item.id];
    let isCorrect = false;

    if (rawAnswer !== undefined && rawAnswer !== null && rawAnswer !== '') {
      if (item.kind === 'choice') {
        isCorrect = String(rawAnswer).trim().toLowerCase() === String(item.correctAnswer).trim().toLowerCase();
      } else {
        // fill - so sánh chuỗi không phân biệt hoa thường và khoảng trắng
        isCorrect = String(rawAnswer).trim().toLowerCase() === String(item.correctAnswer).trim().toLowerCase();
      }
    }

    if (isCorrect) {
      correctCount++;
    } else {
      mistakes.push({
        itemId: item.id,
        prompt: item.prompt,
        studentAnswer: rawAnswer !== undefined ? rawAnswer : null,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation
      });
    }
  }

  const totalItems = items.length;
  const score = correctCount * preset.pointsPerCorrect;
  const maxScore = totalItems * preset.pointsPerCorrect;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = percent >= preset.passPercent;

  return {
    presetId: preset.id,
    status: finishReason,
    finishReason,
    score,
    maxScore,
    percent,
    passed,
    correctCount,
    totalItems,
    elapsedMs,
    mistakes
  };
}

/**
 * Kiểm tra mốc "Sẵn sàng dự thi": 3 đề liên tiếp đạt >= 80%.
 */
export function checkReadinessForExam(
  recentAttempts: { percent: number; passed: boolean }[]
): { readyForExam: boolean; consecutiveCount: number } {
  let consecutive = 0;
  for (const att of recentAttempts) {
    if (att.percent >= 80) {
      consecutive++;
      if (consecutive >= 3) {
        return { readyForExam: true, consecutiveCount: consecutive };
      }
    } else {
      break;
    }
  }
  return { readyForExam: consecutive >= 3, consecutiveCount: consecutive };
}

/**
 * Sinh đề thi ngẫu nhiên nhưng cố định theo hạt seed (hoặc session).
 */
export function selectContestQuestions(
  pool: ContestQuestionItem[],
  count: number,
  seedKey: string
): ContestQuestionItem[] {
  // Lấy băm đơn giản từ seedKey để sinh hoán vị giả định ngẫu nhiên nhưng cố định
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  }

  const copy = [...pool];
  // Thuật toán xáo trộn Fisher-Yates dựa trên seed
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((seed / 4294967296) * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  return copy.slice(0, Math.min(count, copy.length));
}
