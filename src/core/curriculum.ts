import type { ContentPack, LearnerProfile, PairItem, QuizItem, SentenceItem } from './contracts.ts';
import { isCorrectSentence } from './sdk.ts';
import { validatePack } from './validation.ts';
import { audioForItem,isAudioItem,normalizedNumber,normalizedWord,playedAudioItemRefs,richContextFingerprint } from './rich-content.ts';
import { contestPrerequisiteErrors,contestSummary } from './contest-runtime.ts';
import { validateRewardWallet } from './reward-wallet.ts';
import { validateGameAssignments } from './game-assignments.ts';
import { validateGameJourney } from './game-journey.ts';
import type {
  CurriculumEnrollment, CurriculumSnapshot, CurriculumTopic, ExposureSources, LearnerSettings, LearningBlueprint,
  LearningMedia, LearningResponse, LearningSession, LessonCheckpoint, LessonDefinition, LessonEvent,
  LessonForm, LessonPassScope, LessonProgress, MasteryPolicy, PackItemRef, SessionResult, StoredEvent,
  StoredSession, StarTier,
} from './learning-contracts.ts';
import { isLearningSession, isLessonEvent } from './learning-contracts.ts';

const subjects = new Set(['math', 'vietnamese', 'english']);
const modes = new Set(['lesson-practice', 'lesson-assessment', 'lesson-review', 'free-practice', 'contest-mock']);
const activities = new Set(['math-quest', 'memory-match', 'sentence-builder', 'word-connect', 'sequence-trail',
  'lesson-reader', 'practice-runner', 'lesson-assessment', 'lesson-review', 'contest-mock']);
const idPattern = /^[a-zA-Z0-9._:-]{1,120}$/;
const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
type Row = Record<string, unknown>;

/** Tuple keys do not collide when identifiers themselves contain colons. */
export const curriculumKey = (value: Pick<CurriculumSnapshot, 'curriculumId' | 'revision'>): string => JSON.stringify([value.curriculumId, value.revision]);
export const lessonScopeKey = (scope: LessonPassScope): string => JSON.stringify([scope.profileId, scope.curriculumId, scope.curriculumRevision,
  scope.lessonId, scope.lessonRevision, scope.policyId, scope.policyRevision]);
export const itemRefKey = (ref: PackItemRef): string => JSON.stringify([ref.packId, ref.contentVersion, ref.itemId]);
export const sessionResultId = (sessionId: string): string => `result:${sessionId}`;
export const sameLessonScope = (a: LessonPassScope, b: LessonPassScope): boolean => lessonScopeKey(a) === lessonScopeKey(b);
export const vietnamLearningDay = (iso: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
};

class Reader {
  readonly errors: string[] = [];
  error(path: string, message: string): void { this.errors.push(`${path}: ${message}`); }
  object(value: unknown, path: string, keys: string[]): Row | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { this.error(path, 'cần đối tượng dữ liệu.'); return; }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) { this.error(path, 'đối tượng không hợp lệ.'); return; }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key)
      || !own(descriptors[key], 'value') || !descriptors[key].enumerable)) {
      this.error(path, 'có trường không được hỗ trợ hoặc không phải dữ liệu.'); return;
    }
    return value as Row;
  }
  array(value: unknown, path: string, minimum = 0, maximum = 500): unknown[] {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) { this.error(path, 'cần danh sách.'); return []; }
    if (value.length < minimum || value.length > maximum) { this.error(path, `cần ${minimum}–${maximum} mục.`); return []; }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || (key !== 'length'
      && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length || !own(descriptors[key], 'value'))))) {
      this.error(path, 'danh sách không hợp lệ.'); return [];
    }
    for (let index = 0; index < value.length; index++) if (!own(value, String(index))) { this.error(path, 'danh sách thiếu mục.'); return []; }
    return value;
  }
  text(value: unknown, path: string, maximum = 120): value is string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) { this.error(path, 'chuỗi thiếu hoặc quá dài.'); return false; }
    return true;
  }
  id(value: unknown, path: string): value is string {
    if (typeof value !== 'string' || !idPattern.test(value)) { this.error(path, 'mã không hợp lệ.'); return false; }
    return true;
  }
  integer(value: unknown, path: string, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): value is number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
      this.error(path, 'số nguyên không hợp lệ.'); return false;
    }
    return true;
  }
  boolean(value: unknown, path: string): value is boolean {
    if (typeof value !== 'boolean') { this.error(path, 'cần giá trị đúng/sai.'); return false; } return true;
  }
  timestamp(value: unknown, path: string): value is string {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
      this.error(path, 'cần thời điểm ISO UTC hợp lệ.'); return false;
    }
    return true;
  }
  enum(value: unknown, path: string, allowed: Set<string>): void { if (typeof value !== 'string' || !allowed.has(value)) this.error(path, 'giá trị không được hỗ trợ.'); }
  ids(value: unknown, path: string, minimum = 0, maximum = 500): string[] {
    const entries = this.array(value, path, minimum, maximum);
    entries.forEach((entry, index) => this.id(entry, `${path}[${index}]`));
    if (new Set(entries).size !== entries.length) this.error(path, 'mã bị trùng.');
    return entries as string[];
  }
}

function readScope(value: unknown, reader: Reader, path: string): LessonPassScope | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['profileId', 'curriculumId', 'curriculumRevision', 'lessonId', 'lessonRevision', 'policyId', 'policyRevision']);
  if (!row) return;
  for (const key of ['profileId', 'curriculumId', 'lessonId', 'policyId']) reader.id(row[key], `${path}.${key}`);
  for (const key of ['curriculumRevision', 'lessonRevision', 'policyRevision']) reader.integer(row[key], `${path}.${key}`);
  return reader.errors.length === before ? row as unknown as LessonPassScope : undefined;
}

function readRef(value: unknown, reader: Reader, path: string): PackItemRef | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['packId', 'contentVersion', 'itemId']);
  if (!row) return;
  reader.id(row.packId, `${path}.packId`); reader.id(row.itemId, `${path}.itemId`); reader.integer(row.contentVersion, `${path}.contentVersion`);
  return reader.errors.length === before ? row as unknown as PackItemRef : undefined;
}

function readBlueprint(value: unknown, reader: Reader, path: string): LearningBlueprint | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['blueprintId', 'revision', 'minimumItems', 'objectives', 'allowReadAloud']);
  if (!row) return;
  reader.id(row.blueprintId, `${path}.blueprintId`); reader.integer(row.revision, `${path}.revision`);
  reader.integer(row.minimumItems, `${path}.minimumItems`, 1, 200); reader.boolean(row.allowReadAloud, `${path}.allowReadAloud`);
  const objectives = reader.array(row.objectives, `${path}.objectives`, 1, 30);
  const ids: unknown[] = [];
  objectives.forEach((value, index) => {
    const objective = reader.object(value, `${path}.objectives[${index}]`, ['objectiveId', 'minimumItems']);
    if (!objective) return;
    reader.id(objective.objectiveId, `${path}.objectives[${index}].objectiveId`);
    reader.integer(objective.minimumItems, `${path}.objectives[${index}].minimumItems`, 1, 200); ids.push(objective.objectiveId);
  });
  if (new Set(ids).size !== ids.length) reader.error(path, 'mục tiêu blueprint bị trùng.');
  return reader.errors.length === before ? row as unknown as LearningBlueprint : undefined;
}

function readPolicy(value: unknown, reader: Reader, path: string): MasteryPolicy | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['policyId', 'revision', 'passPercent', 'minIndependentItems', 'reviewDelayHours', 'timeZone']);
  if (!row) return;
  reader.id(row.policyId, `${path}.policyId`); reader.integer(row.revision, `${path}.revision`);
  reader.integer(row.passPercent, `${path}.passPercent`, 1, 100);
  reader.integer(row.minIndependentItems, `${path}.minIndependentItems`, 5, 200);
  reader.integer(row.reviewDelayHours, `${path}.reviewDelayHours`, 24, 8760);
  if (row.timeZone !== 'Asia/Ho_Chi_Minh') reader.error(path, 'ngày học phải dùng Asia/Ho_Chi_Minh.');
  return reader.errors.length === before ? row as unknown as MasteryPolicy : undefined;
}

function readForm(value: unknown, reader: Reader, path: string): LessonForm | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['formId', 'revision', 'role', 'blueprint', 'itemRefs', 'equivalenceGroupId', 'approvedAt', 'activityId']);
  if (!row) return;
  reader.id(row.formId, `${path}.formId`); reader.integer(row.revision, `${path}.revision`);
  reader.enum(row.role, `${path}.role`, new Set(['practice', 'assessment', 'review']));
  reader.enum(row.activityId, `${path}.activityId`, activities); reader.id(row.equivalenceGroupId, `${path}.equivalenceGroupId`);
  reader.timestamp(row.approvedAt, `${path}.approvedAt`); readBlueprint(row.blueprint, reader, `${path}.blueprint`);
  const refs = reader.array(row.itemRefs, `${path}.itemRefs`, 1, 200).map((ref, index) => readRef(ref, reader, `${path}.itemRefs[${index}]`));
  const valid = refs.filter((ref): ref is PackItemRef => !!ref);
  if (new Set(valid.map(itemRefKey)).size !== valid.length) reader.error(path, 'câu hỏi trong form bị trùng.');
  return reader.errors.length === before ? row as unknown as LessonForm : undefined;
}

function readLesson(value: unknown, reader: Reader, path: string): LessonDefinition | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['lessonId', 'revision', 'rewardGroupId', 'topicId', 'subject', 'grade', 'title', 'objectiveIds',
    'knowledgeIds', 'prerequisiteLessonIds', 'policyId', 'policyRevision', 'steps', 'forms', 'mediaIds','usage']);
  if (!row) return;
  for (const key of ['lessonId', 'rewardGroupId', 'topicId', 'policyId']) reader.id(row[key], `${path}.${key}`);
  reader.integer(row.revision, `${path}.revision`); reader.integer(row.policyRevision, `${path}.policyRevision`);
  reader.integer(row.grade, `${path}.grade`, 1, 12); reader.enum(row.subject, `${path}.subject`, subjects); reader.text(row.title, `${path}.title`, 160);
  reader.ids(row.objectiveIds, `${path}.objectiveIds`, 1, 30); reader.ids(row.prerequisiteLessonIds, `${path}.prerequisiteLessonIds`, 0, 100);
  if (own(row, 'knowledgeIds')) reader.ids(row.knowledgeIds, `${path}.knowledgeIds`, 1, 30);
  if (own(row, 'mediaIds')) reader.ids(row.mediaIds, `${path}.mediaIds`, 0, 100);
  if(own(row,'usage'))reader.enum(row.usage,`${path}.usage`,new Set(['self-study','contest']));
  const steps = reader.array(row.steps, `${path}.steps`, 1, 30);
  const stepIds: unknown[] = [];
  steps.forEach((value, index) => {
    const step = reader.object(value, `${path}.steps[${index}]`, ['stepId', 'title', 'body', 'example']);
    if (!step) return;
    reader.id(step.stepId, `${path}.steps[${index}].stepId`); reader.text(step.title, `${path}.steps[${index}].title`, 160);
    reader.text(step.body, `${path}.steps[${index}].body`, 4000);
    if (own(step, 'example')) reader.text(step.example, `${path}.steps[${index}].example`, 2000);
    stepIds.push(step.stepId);
  });
  if (new Set(stepIds).size !== stepIds.length) reader.error(path, 'bước học bị trùng.');
  const forms = reader.array(row.forms, `${path}.forms`, row.usage==='contest'?1:3, 60).map((value, index) => readForm(value, reader, `${path}.forms[${index}]`));
  const valid = forms.filter((form): form is LessonForm => !!form);
  if (new Set(valid.map(form => form.formId)).size !== valid.length) reader.error(path, 'mã form bị trùng.');
  return reader.errors.length === before ? row as unknown as LessonDefinition : undefined;
}

function readTopic(value: unknown, reader: Reader, path: string): CurriculumTopic | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['topicId', 'title', 'subject', 'grade', 'lessonIds']);
  if (!row) return;
  reader.id(row.topicId, `${path}.topicId`); reader.text(row.title, `${path}.title`, 160);
  reader.enum(row.subject, `${path}.subject`, subjects); reader.integer(row.grade, `${path}.grade`, 1, 12); reader.ids(row.lessonIds, `${path}.lessonIds`, 1, 100);
  return reader.errors.length === before ? row as unknown as CurriculumTopic : undefined;
}

function readMedia(value: unknown, reader: Reader, path: string): LearningMedia | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['mediaId', 'kind', 'url', 'sha256', 'transcript', 'source', 'rights', 'approvedAt']);
  if (!row) return;
  reader.id(row.mediaId, `${path}.mediaId`); reader.enum(row.kind, `${path}.kind`, new Set(['audio', 'image']));
  reader.text(row.url, `${path}.url`, 500); reader.text(row.source, `${path}.source`, 1000); reader.text(row.rights, `${path}.rights`, 1000);
  if (typeof row.url === 'string' && (!row.url.startsWith('/') || row.url.startsWith('//') || row.url.includes('..') || row.url.includes('\\'))) reader.error(path, 'media phải dùng đường dẫn catalog nội bộ.');
  if (typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256)) reader.error(path, 'thiếu hash SHA-256 media.');
  if (row.kind === 'audio' || own(row, 'transcript')) reader.text(row.transcript, `${path}.transcript`, 8000);
  reader.timestamp(row.approvedAt, `${path}.approvedAt`);
  return reader.errors.length === before ? row as unknown as LearningMedia : undefined;
}

export function findRefItem(ref: PackItemRef, packs: ContentPack[]): ContentPack['items'][number] | undefined {
  return packs.find(pack => pack.id === ref.packId && pack.version === ref.contentVersion)?.items.find(item => item.id === ref.itemId);
}

/** Ignore identifiers, explanation and option order when detecting a re-labelled question. */
export function itemContentFingerprint(ref: PackItemRef, packs: ContentPack[]): string | undefined {
  const item = findRefItem(ref, packs);
  if (!item) return;
  if (item.kind === 'multiple-choice'||item.kind==='numeric-answer'||item.kind==='fill-blank') return JSON.stringify(['question', normalize(item.prompt)]);
  if (item.kind === 'pair') return JSON.stringify(['pair', ...[normalize(item.left), normalize(item.right)].sort()]);
  if(item.kind==='sentence')return JSON.stringify(['sentence', normalize(item.words.join(' '))]);
  return JSON.stringify(['context-question',richContextFingerprint(ref,packs),normalize(item.prompt)]);
}

export function validateCurriculum(input: unknown, packs: ContentPack[]): string[] {
  const reader = new Reader();
  const row = reader.object(input, 'Lộ trình', ['schemaVersion', 'curriculumId', 'revision', 'title', 'subject', 'grade', 'publishedAt', 'topics', 'policies', 'lessons', 'media','contestPreset']);
  if (!row) return reader.errors;
  if (row.schemaVersion !== 1) reader.error('Lộ trình', 'schema chưa được hỗ trợ.');
  reader.id(row.curriculumId, 'Lộ trình.curriculumId'); reader.integer(row.revision, 'Lộ trình.revision');
  reader.text(row.title, 'Lộ trình.title', 160); reader.enum(row.subject, 'Lộ trình.subject', subjects);
  reader.integer(row.grade, 'Lộ trình.grade', 1, 12); reader.timestamp(row.publishedAt, 'Lộ trình.publishedAt');
  const policies = reader.array(row.policies, 'Lộ trình.policies', 1, 100).map((value, index) => readPolicy(value, reader, `Policy[${index}]`));
  const topics = reader.array(row.topics, 'Lộ trình.topics', 1, 100).map((value, index) => readTopic(value, reader, `Chủ đề[${index}]`));
  const lessons = reader.array(row.lessons, 'Lộ trình.lessons', 1, 100).map((value, index) => readLesson(value, reader, `Bài[${index}]`));
  const media = reader.array(row.media, 'Lộ trình.media', 0, 500).map((value, index) => readMedia(value, reader, `Media[${index}]`));
  if(own(row,'contestPreset')){
    const preset=reader.object(row.contestPreset,'Preset',['presetId','revision','contest','schoolYear','grade','title','durationSeconds','pointsPerCorrect','verification','sourceUrl','verifiedAt','requiredCurriculumId','requiredLessonIds']);
    if(preset){reader.id(preset.presetId,'Preset.presetId');reader.integer(preset.revision,'Preset.revision');reader.enum(preset.contest,'Preset.contest',new Set(['violympic','ioe','trang-nguyen']));
      reader.text(preset.schoolYear,'Preset.schoolYear',9);if(typeof preset.schoolYear!=='string'||!/^\d{4}-\d{4}$/.test(preset.schoolYear))reader.error('Preset','năm học không hợp lệ.');
      reader.integer(preset.grade,'Preset.grade',1,12);reader.text(preset.title,'Preset.title',160);reader.integer(preset.durationSeconds,'Preset.durationSeconds',60,7200);reader.integer(preset.pointsPerCorrect,'Preset.pointsPerCorrect',1,1000);
      reader.enum(preset.verification,'Preset.verification',new Set(['general-practice','verified-format']));reader.text(preset.sourceUrl,'Preset.sourceUrl',1000);
      try{const url=new URL(preset.sourceUrl as string);if(url.protocol!=='https:'||url.username||url.password)reader.error('Preset','nguồn phải là URL HTTPS.');}catch{reader.error('Preset','URL nguồn không hợp lệ.');}
      reader.timestamp(preset.verifiedAt,'Preset.verifiedAt');reader.id(preset.requiredCurriculumId,'Preset.requiredCurriculumId');reader.ids(preset.requiredLessonIds,'Preset.requiredLessonIds',1,30);
      if(preset.grade!==row.grade)reader.error('Preset','khối lớp không khớp lộ trình.');
    }
  }
  if (reader.errors.length) return reader.errors;
  const curriculum = row as unknown as CurriculumSnapshot;
  const policyMap = new Map(policies.map(policy => [JSON.stringify([policy!.policyId, policy!.revision]), policy!]));
  const topicMap = new Map(topics.map(topic => [topic!.topicId, topic!]));
  const lessonMap = new Map(lessons.map(lesson => [lesson!.lessonId, lesson!]));
  if (policyMap.size !== policies.length) reader.error('Lộ trình', 'policy bị trùng ID/revision.');
  if (topicMap.size !== topics.length) reader.error('Lộ trình', 'chủ đề bị trùng ID.');
  if (lessonMap.size !== lessons.length) reader.error('Lộ trình', 'bài bị trùng ID.');
  const mediaIds = new Set(media.map(entry => entry!.mediaId));
  if (mediaIds.size !== media.length) reader.error('Lộ trình', 'media bị trùng ID.');
  const usedPacks = new Set<string>();
  for (const topic of curriculum.topics) {
    if (topic.subject !== curriculum.subject || topic.grade !== curriculum.grade) reader.error(topic.topicId, 'môn/lớp chủ đề không khớp lộ trình.');
    for (const id of topic.lessonIds) if (!lessonMap.has(id) || lessonMap.get(id)!.topicId !== topic.topicId) reader.error(topic.topicId, `bài ${id} thiếu hoặc thuộc chủ đề khác.`);
  }
  for (const lesson of curriculum.lessons) {
    const label = `Bài ${lesson.lessonId}`;
    const topic = topicMap.get(lesson.topicId);
    if (!topic || !topic.lessonIds.includes(lesson.lessonId)) reader.error(label, 'không được liệt kê trong đúng chủ đề.');
    if (lesson.subject !== curriculum.subject || lesson.grade !== curriculum.grade) reader.error(label, 'môn/lớp không khớp lộ trình.');
    for (const id of lesson.prerequisiteLessonIds) if (!lessonMap.has(id) || id === lesson.lessonId) reader.error(label, `bài tiên quyết ${id} thiếu hoặc tự tham chiếu.`);
    for (const id of lesson.mediaIds ?? []) if (!mediaIds.has(id)) reader.error(label, `media ${id} không tồn tại.`);
    const policy = policyMap.get(JSON.stringify([lesson.policyId, lesson.policyRevision]));
    if (!policy) { reader.error(label, 'policy revision không tồn tại.'); continue; }
    if(lesson.usage!=='contest')for (const role of ['practice', 'assessment', 'review']) if (!lesson.forms.some(form => form.role === role)) reader.error(label, `thiếu form ${role}.`);
    if(lesson.usage==='contest'&&!curriculum.contestPreset)reader.error(label,'bài tổng hợp thiếu preset.');
    const seenIdentity = new Map<string, string>();
    const seenContent = new Map<string, string>();
    const seenContexts=new Map<string,string>();
    const equivalenceGroups = new Set(lesson.forms.filter(form => form.role !== 'practice').map(form => form.equivalenceGroupId));
    if (lesson.usage!=='contest'&&equivalenceGroups.size !== 1) reader.error(label, 'form kiểm tra/ôn phải cùng nhóm tương đương đã duyệt.');
    for (const form of lesson.forms) {
      const formLabel = `${label}, form ${form.formId}`;
      if (Date.parse(form.approvedAt) > Date.parse(curriculum.publishedAt)) reader.error(formLabel, 'duyệt sau thời điểm xuất bản.');
      if (form.role !== 'practice' && form.activityId === 'memory-match') reader.error(formLabel, 'Memory Match chỉ dùng để luyện.');
      if (form.role !== 'practice' && (form.itemRefs.length < policy.minIndependentItems || form.blueprint.minimumItems < policy.minIndependentItems)) reader.error(formLabel, 'kiểm tra/ôn thiếu số câu độc lập tối thiểu.');
      if (form.itemRefs.length < form.blueprint.minimumItems) reader.error(formLabel, 'không đủ số câu blueprint.');
      const counts = new Map<string, number>();
      for (const ref of form.itemRefs) {
        const identity = itemRefKey(ref);
        const pack = packs.find(pack => pack.id === ref.packId && pack.version === ref.contentVersion);
        const item = findRefItem(ref, packs);
        if (!pack || !item) { reader.error(formLabel, `thiếu câu ${identity} trong đúng phiên bản học liệu.`); continue; }
        const key = JSON.stringify([pack.id, pack.version]);
        if (!usedPacks.has(key)) {
          usedPacks.add(key); const errors = validatePack(pack); errors.forEach(error => reader.error(formLabel, error));
        }
        if (pack.subject !== lesson.subject || pack.grade !== lesson.grade) reader.error(formLabel, 'học liệu sai môn/lớp.');
        if (!lesson.objectiveIds.includes(item.objectiveId)) reader.error(formLabel, 'câu hỏi ngoài mục tiêu bài.');
        counts.set(item.objectiveId, (counts.get(item.objectiveId) ?? 0) + 1);
        const fingerprint = itemContentFingerprint(ref, packs)!;
        const contentContext=richContextFingerprint(ref,packs);
        if(contentContext){const prior=seenContexts.get(contentContext);if(prior&&prior!==form.formId)reader.error(formLabel,`ngữ liệu/âm thanh đã có trong form ${prior}; cần ngữ liệu khác cho lượt độc lập.`);seenContexts.set(contentContext,form.formId);}
        const audio=audioForItem(ref,packs);
        if(audio){const pinned=curriculum.media.find(media=>media.mediaId===audio.mediaId);if(!pinned||pinned.sha256!==audio.sha256||pinned.url!==audio.url||pinned.transcript!==audio.transcript||!lesson.mediaIds?.includes(audio.mediaId))reader.error(formLabel,'âm thanh chưa ghim trong catalog bài học.');}
        if (seenIdentity.has(identity)) reader.error(formLabel, `câu hỏi trùng với form ${seenIdentity.get(identity)}; không độc lập.`);
        if (seenContent.has(fingerprint)) reader.error(formLabel, `nội dung đã có trong form ${seenContent.get(fingerprint)}; đổi ID/đáp án không tạo đề độc lập.`);
        seenIdentity.set(identity, form.formId); seenContent.set(fingerprint, form.formId);
      }
      const covered = new Set(form.blueprint.objectives.map(objective => objective.objectiveId));
      for (const objectiveId of lesson.objectiveIds) if (!covered.has(objectiveId)) reader.error(formLabel, `blueprint thiếu mục tiêu ${objectiveId}.`);
      for (const objective of form.blueprint.objectives) {
        if (!lesson.objectiveIds.includes(objective.objectiveId)) reader.error(formLabel, 'blueprint chứa mục tiêu ngoài bài.');
        if ((counts.get(objective.objectiveId) ?? 0) < objective.minimumItems) reader.error(formLabel, `thiếu coverage ${objective.objectiveId}.`);
      }
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) { reader.error('Lộ trình', `vòng bài tiên quyết tại ${id}.`); return; }
    if (visited.has(id)) return;
    visiting.add(id); for (const prior of lessonMap.get(id)?.prerequisiteLessonIds ?? []) if (lessonMap.has(prior)) visit(prior);
    visiting.delete(id); visited.add(id);
  };
  for (const id of lessonMap.keys()) visit(id);
  return reader.errors;
}

export const validateCurriculumSnapshot = validateCurriculum;

function readEnrollment(value: unknown, reader: Reader, path: string): CurriculumEnrollment | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['curriculumId', 'curriculumRevision', 'enrolledAt', 'manualUnlocks']);
  if (!row) return;
  reader.id(row.curriculumId, `${path}.curriculumId`); reader.integer(row.curriculumRevision, `${path}.curriculumRevision`); reader.timestamp(row.enrolledAt, `${path}.enrolledAt`);
  const unlockIds: unknown[] = [];
  reader.array(row.manualUnlocks, `${path}.manualUnlocks`, 0, 100).forEach((value, index) => {
    const unlock = reader.object(value, `${path}.manualUnlocks[${index}]`, ['lessonId', 'reason', 'openedAt']);
    if (!unlock) return;
    reader.id(unlock.lessonId, `${path}.manualUnlocks[${index}].lessonId`); reader.text(unlock.reason, `${path}.manualUnlocks[${index}].reason`, 500);
    reader.timestamp(unlock.openedAt, `${path}.manualUnlocks[${index}].openedAt`); unlockIds.push(unlock.lessonId);
  });
  if (new Set(unlockIds).size !== unlockIds.length) reader.error(path, 'mở bài thủ công bị trùng.');
  return reader.errors.length === before ? row as unknown as CurriculumEnrollment : undefined;
}

export function validateLearnerSettings(input: unknown, curricula: CurriculumSnapshot[]): string[] {
  const reader = new Reader();
  const row = reader.object(input, 'Cài đặt học', ['schemaVersion', 'enrollments', 'preferredSubjects', 'textbook', 'accessibility', 'contestChecklist','rewardWallet','gameAssignments','gameJourney']);
  if (!row) return reader.errors;
  if (row.schemaVersion !== 1) reader.error('Cài đặt học', 'schema chưa được hỗ trợ.');
  const enrollments = reader.array(row.enrollments, 'Enrollment', 0, 30).map((value, index) => readEnrollment(value, reader, `Enrollment[${index}]`));
  const preferred = reader.array(row.preferredSubjects, 'Môn ưu tiên', 0, 3);
  preferred.forEach(value => reader.enum(value, 'Môn ưu tiên', subjects));
  if (new Set(preferred).size !== preferred.length) reader.error('Môn ưu tiên', 'môn bị trùng.');
  if (own(row, 'textbook')) reader.text(row.textbook, 'Bộ sách', 160);
  if (own(row, 'accessibility')) {
    const access = reader.object(row.accessibility, 'Hỗ trợ', ['readAloud', 'largeText', 'reduceMotion']);
    if (access) for (const key of ['readAloud', 'largeText', 'reduceMotion']) reader.boolean(access[key], `Hỗ trợ.${key}`);
  }
  if (own(row, 'contestChecklist')) reader.array(row.contestChecklist, 'Checklist', 0, 100).forEach((value, index) => {
    const check = reader.object(value, `Checklist[${index}]`, ['contest', 'label', 'confirmedAt', 'source']);
    if (!check) return;
    reader.enum(check.contest, `Checklist[${index}].contest`, new Set(['violympic', 'ioe', 'trang-nguyen']));
    reader.text(check.label, `Checklist[${index}].label`, 300); reader.text(check.source, `Checklist[${index}].source`, 1000);
    reader.timestamp(check.confirmedAt, `Checklist[${index}].confirmedAt`);
  });
  if(own(row,'rewardWallet'))for(const error of validateRewardWallet(row.rewardWallet))reader.error('Cài đặt học',error);
  if(own(row,'gameAssignments'))for(const error of validateGameAssignments(row.gameAssignments))reader.error('Cài đặt học',error);
  if(own(row,'gameJourney'))for(const error of validateGameJourney(row.gameJourney))reader.error('Cài đặt học',error);
  if (reader.errors.length) return reader.errors;
  const settings = row as unknown as LearnerSettings;
  const keys = enrollments.map(entry => curriculumKey({ curriculumId: entry!.curriculumId, revision: entry!.curriculumRevision }));
  if (new Set(keys).size !== keys.length) reader.error('Enrollment', 'lộ trình/revision bị trùng.');
  for (const entry of settings.enrollments) {
    const curriculum = curricula.find(candidate => candidate.curriculumId === entry.curriculumId && candidate.revision === entry.curriculumRevision);
    if (!curriculum) { reader.error('Enrollment', 'thiếu snapshot đúng revision.'); continue; }
    for (const unlock of entry.manualUnlocks) if (!curriculum.lessons.some(lesson => lesson.lessonId === unlock.lessonId)) reader.error('Enrollment', 'bài mở thủ công không thuộc snapshot.');
  }
  return reader.errors;
}

function resolveScope(scope: LessonPassScope, curricula: CurriculumSnapshot[], reader: Reader): { curriculum: CurriculumSnapshot; lesson: LessonDefinition; policy: MasteryPolicy } | undefined {
  const curriculum = curricula.find(row => row.curriculumId === scope.curriculumId && row.revision === scope.curriculumRevision);
  const lesson = curriculum?.lessons.find(row => row.lessonId === scope.lessonId && row.revision === scope.lessonRevision);
  const policy = curriculum?.policies.find(row => row.policyId === scope.policyId && row.revision === scope.policyRevision);
  if (!curriculum || !lesson || !policy || lesson.policyId !== scope.policyId || lesson.policyRevision !== scope.policyRevision) {
    reader.error('Scope', 'thiếu đúng snapshot/bài/policy revision.'); return;
  }
  return { curriculum, lesson, policy };
}

function sameBlueprint(a: LearningBlueprint, b: LearningBlueprint): boolean {
  const key = (value: LearningBlueprint) => JSON.stringify([value.blueprintId, value.revision, value.minimumItems, value.allowReadAloud,
    value.objectives.map(objective => [objective.objectiveId, objective.minimumItems])]);
  return key(a) === key(b);
}

function readCheckpoint(value: unknown, reader: Reader, path: string): LessonCheckpoint | undefined {
  const before = reader.errors.length;
  const row = reader.object(value, path, ['schemaVersion', 'stepIndex', 'readStepIds', 'formId', 'formRevision', 'seed', 'itemOrder', 'receipts', 'exposedItemKeys', 'deadlineAt', 'updatedAt','mediaPlayback','skippedItemKeys']);
  if (!row) return;
  if (row.schemaVersion !== 1) reader.error(path, 'schema chưa được hỗ trợ.');
  reader.integer(row.stepIndex, `${path}.stepIndex`, 0, 30); reader.ids(row.readStepIds, `${path}.readStepIds`, 0, 30);
  reader.id(row.formId, `${path}.formId`); reader.integer(row.formRevision, `${path}.formRevision`); reader.text(row.seed, `${path}.seed`, 200);
  reader.array(row.itemOrder, `${path}.itemOrder`, 1, 200).forEach((ref, index) => readRef(ref, reader, `${path}.itemOrder[${index}]`));
  const attemptKeys: unknown[] = [], eventIds: unknown[] = [];
  reader.array(row.receipts, `${path}.receipts`, 0, 4000).forEach((value, index) => {
    const receipt = reader.object(value, `${path}.receipts[${index}]`, ['attemptKey', 'eventId', 'itemKey', 'submissionIndex', 'committedAt']);
    if (!receipt) return;
    reader.id(receipt.attemptKey, `${path}.receipts[${index}].attemptKey`); reader.text(receipt.eventId, `${path}.receipts[${index}].eventId`, 260);
    reader.text(receipt.itemKey, `${path}.receipts[${index}].itemKey`, 400); reader.integer(receipt.submissionIndex, `${path}.receipts[${index}].submissionIndex`, 1, 100);
    reader.timestamp(receipt.committedAt, `${path}.receipts[${index}].committedAt`); attemptKeys.push(receipt.attemptKey); eventIds.push(receipt.eventId);
  });
  if (new Set(attemptKeys).size !== attemptKeys.length || new Set(eventIds).size !== eventIds.length) reader.error(path, 'receipt bị trùng.');
  const exposed = reader.array(row.exposedItemKeys, `${path}.exposedItemKeys`, 0, 200);
  exposed.forEach((key, index) => reader.text(key, `${path}.exposedItemKeys[${index}]`, 400));
  if (new Set(exposed).size !== exposed.length) reader.error(path, 'câu đã lộ bị trùng.');
  if (own(row, 'deadlineAt')) reader.timestamp(row.deadlineAt, `${path}.deadlineAt`);
  reader.timestamp(row.updatedAt, `${path}.updatedAt`);
  if(own(row,'skippedItemKeys')){const keys=reader.array(row.skippedItemKeys,`${path}.skippedItemKeys`,0,200);keys.forEach((key,index)=>reader.text(key,`${path}.skippedItemKeys[${index}]`,400));if(new Set(keys).size!==keys.length)reader.error(path,'câu bỏ qua bị trùng.');}
  if(own(row,'mediaPlayback')){const ids:unknown[]=[];reader.array(row.mediaPlayback,`${path}.mediaPlayback`,0,200).forEach((value,index)=>{
    const receipt=reader.object(value,`${path}.mediaPlayback[${index}]`,['mediaId','sha256','completedAt']);if(!receipt)return;
    reader.id(receipt.mediaId,`${path}.mediaPlayback[${index}].mediaId`);reader.timestamp(receipt.completedAt,`${path}.mediaPlayback[${index}].completedAt`);
    if(typeof receipt.sha256!=='string'||!/^[a-f0-9]{64}$/.test(receipt.sha256))reader.error(path,'hash âm thanh đã nghe không hợp lệ.');ids.push(receipt.mediaId);
  });if(new Set(ids).size!==ids.length)reader.error(path,'âm thanh đã nghe bị trùng.');}
  return reader.errors.length === before ? row as unknown as LessonCheckpoint : undefined;
}

export function validateLearningSession(input: unknown, curricula: CurriculumSnapshot[], packs: ContentPack[], profiles?: LearnerProfile[]): string[] {
  const reader = new Reader();
  const row = reader.object(input, 'Phiên học', ['schemaVersion', 'sessionId', 'profileId', 'mode', 'activityId', 'activityVersion', 'scope', 'rewardGroupId',
    'formId', 'formRevision', 'blueprint', 'startedAt', 'endedAt', 'status', 'ownerTabId', 'checkpoint', 'sourcePracticeResultIds', 'sourcePassResultId', 'exposureSources', 'guidedFrom','contestSource']);
  if (!row) return reader.errors;
  if (row.schemaVersion !== 1) reader.error('Phiên học', 'schema chưa được hỗ trợ.');
  for (const key of ['sessionId', 'profileId', 'rewardGroupId', 'formId']) reader.id(row[key], `Phiên học.${key}`);
  reader.integer(row.formRevision, 'Phiên học.formRevision'); reader.text(row.activityVersion, 'Phiên học.activityVersion', 80);
  reader.enum(row.mode, 'Phiên học.mode', modes); reader.enum(row.activityId, 'Phiên học.activityId', activities);
  reader.enum(row.status, 'Phiên học.status', new Set(['active', 'paused', 'completed', 'abandoned']));
  if (own(row, 'guidedFrom')) {
    reader.enum(row.guidedFrom, 'Phiên học.guidedFrom', new Set(['lesson-assessment', 'lesson-review']));
    if (row.mode !== 'lesson-practice') reader.error('Phiên học', 'lượt dùng gợi ý phải chuyển thành luyện.');
  }
  reader.timestamp(row.startedAt, 'Phiên học.startedAt'); if (own(row, 'endedAt')) reader.timestamp(row.endedAt, 'Phiên học.endedAt');
  if (own(row, 'ownerTabId')) reader.id(row.ownerTabId, 'Phiên học.ownerTabId');
  const scope = readScope(row.scope, reader, 'Phiên học.scope'); readBlueprint(row.blueprint, reader, 'Phiên học.blueprint');
  readCheckpoint(row.checkpoint, reader, 'Phiên học.checkpoint');
  const sourceIds = reader.array(row.sourcePracticeResultIds, 'Phiên học.sourcePracticeResultIds', 0, 100);
  sourceIds.forEach((id, index) => reader.text(id, `Phiên học.sourcePracticeResultIds[${index}]`, 160));
  if (new Set(sourceIds).size !== sourceIds.length) reader.error('Phiên học', 'nguồn luyện bị trùng.');
  if (own(row, 'sourcePassResultId')) reader.text(row.sourcePassResultId, 'Phiên học.sourcePassResultId', 160);
  if (own(row, 'exposureSources')) readExposureSources(row.exposureSources, reader);
  if(own(row,'contestSource')){const source=reader.object(row.contestSource,'Nguồn lộ trình nền',['curriculumId','curriculumRevision']);if(source){reader.id(source.curriculumId,'Nguồn nền.curriculumId');reader.integer(source.curriculumRevision,'Nguồn nền.curriculumRevision');}}
  if (reader.errors.length || !scope) return reader.errors;
  const session = row as unknown as LearningSession;
  if (scope.profileId !== session.profileId) reader.error('Phiên học', 'hồ sơ không khớp scope.');
  if (profiles) {
    const profile = profiles.find(profile => profile.profileId === session.profileId);
    if (!profile) reader.error('Phiên học', 'hồ sơ không tồn tại.');
    else if (!profile.learningSettings?.enrollments.some(enrollment => enrollment.curriculumId === scope.curriculumId
      && enrollment.curriculumRevision === scope.curriculumRevision)) reader.error('Phiên học', 'hồ sơ chưa ghim đúng enrollment revision.');
  }
  const resolved = resolveScope(scope, curricula, reader);
  if (!resolved) return reader.errors;
  const form = resolved.lesson.forms.find(form => form.formId === session.formId && form.revision === session.formRevision);
  if (!form) { reader.error('Phiên học', 'thiếu đúng form revision.'); return reader.errors; }
  if (session.rewardGroupId !== resolved.lesson.rewardGroupId || session.activityId !== form.activityId) reader.error('Phiên học', 'reward/activity không khớp snapshot.');
  if (!sameBlueprint(session.blueprint, form.blueprint)) reader.error('Phiên học', 'blueprint đã đổi so với snapshot.');
  const originalMode = session.guidedFrom ?? session.mode;
  const expectedRole = originalMode === 'lesson-assessment' ? 'assessment' : originalMode === 'lesson-review' ? 'review' : originalMode === 'lesson-practice' ? 'practice' : undefined;
  if (expectedRole && form.role !== expectedRole) reader.error('Phiên học', 'mode không khớp vai trò form.');
  const checkpoint = session.checkpoint;
  if (checkpoint.formId !== session.formId || checkpoint.formRevision !== session.formRevision) reader.error('Checkpoint', 'form không khớp phiên.');
  const expectedKeys = form.itemRefs.map(itemRefKey).sort(), actualKeys = checkpoint.itemOrder.map(itemRefKey).sort();
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) reader.error('Checkpoint', 'thứ tự câu phải là hoán vị đúng form, không thiếu/trùng/thay câu.');
  for (const ref of checkpoint.itemOrder) if (!findRefItem(ref, packs)) reader.error('Checkpoint', 'thiếu câu trong đúng phiên bản học liệu.');
  for(const playback of checkpoint.mediaPlayback??[]){const media=checkpoint.itemOrder.map(ref=>audioForItem(ref,packs)).find(media=>media?.mediaId===playback.mediaId);
    if(!media||media.sha256!==playback.sha256||Date.parse(playback.completedAt)<Date.parse(session.startedAt)||Date.parse(playback.completedAt)>Date.parse(checkpoint.updatedAt))reader.error('Checkpoint','lần nghe không khớp clip/hash/thời điểm đã ghim.');}
  const steps = new Set(resolved.lesson.steps.map(step => step.stepId));
  if (checkpoint.stepIndex > resolved.lesson.steps.length || checkpoint.readStepIds.some(id => !steps.has(id))) reader.error('Checkpoint', 'bước học không thuộc bài.');
  const keys = new Set(actualKeys);
  for(const key of checkpoint.skippedItemKeys??[])if(session.mode!=='contest-mock'||!keys.has(key)||checkpoint.receipts.some(receipt=>receipt.itemKey===key))reader.error('Checkpoint','câu bỏ qua sai phiên hoặc đã có câu trả lời.');
  if(session.mode==='contest-mock'){
    const preset=resolved.curriculum.contestPreset,source=session.contestSource;
    if(resolved.lesson.usage!=='contest'||!preset||!source||source.curriculumId!==preset.requiredCurriculumId||!curricula.some(c=>c.curriculumId===source.curriculumId&&c.revision===source.curriculumRevision))reader.error('Phiên học','lượt tổng hợp thiếu preset hoặc nguồn nền đúng revision.');
    if(source&&profiles&&!profiles.find(profile=>profile.profileId===session.profileId)?.learningSettings?.enrollments.some(enrollment=>enrollment.curriculumId===source.curriculumId&&enrollment.curriculumRevision===source.curriculumRevision))reader.error('Phiên học','hồ sơ chưa ghim lộ trình nền đúng revision.');
    if(preset&&checkpoint.deadlineAt!==new Date(Date.parse(session.startedAt)+preset.durationSeconds*1000).toISOString())reader.error('Checkpoint','deadline khác preset đã ghim.');
  }else if(resolved.lesson.usage==='contest'||session.contestSource)reader.error('Phiên học','bài tổng hợp chỉ chạy trong mode luyện tổng hợp.');
  for (const receipt of checkpoint.receipts) if (!keys.has(receipt.itemKey) || receipt.eventId !== `${session.sessionId}:${receipt.attemptKey}`
    || Date.parse(receipt.committedAt) < Date.parse(session.startedAt) || Date.parse(receipt.committedAt) > Date.parse(checkpoint.updatedAt)) reader.error('Checkpoint', 'receipt không khớp phiên/câu/thời điểm.');
  if (checkpoint.exposedItemKeys.some(key => !keys.has(key))) reader.error('Checkpoint', 'câu đã lộ không thuộc form.');
  const started = Date.parse(session.startedAt), updated = Date.parse(checkpoint.updatedAt);
  if (updated < started || (checkpoint.deadlineAt && Date.parse(checkpoint.deadlineAt) < started)) reader.error('Checkpoint', 'mốc thời gian trước lúc bắt đầu.');
  const ended = session.status === 'completed' || session.status === 'abandoned';
  if (ended !== !!session.endedAt || (session.endedAt && (Date.parse(session.endedAt) < started || Date.parse(session.endedAt) < updated))) reader.error('Phiên học', 'trạng thái/thời điểm kết thúc không hợp lệ.');
  return reader.errors;
}

function readExposureSources(value: unknown, reader: Reader): ExposureSources | undefined {
  const before = reader.errors.length, path = 'Cơ sở câu đã lộ';
  const row = reader.object(value, path, ['resultIds', 'sessionIds', 'itemKeys', 'legacyEventIds']);
  if (!row) return;
  const resultIds = reader.array(row.resultIds, `${path}.resultIds`, 0, 10_000);
  resultIds.forEach((id, index) => reader.text(id, `${path}.resultIds[${index}]`, 160));
  reader.ids(row.sessionIds, `${path}.sessionIds`, 0, 10_000);
  const itemKeys = reader.array(row.itemKeys, `${path}.itemKeys`, 0, 100_000);
  itemKeys.forEach((key, index) => {
    if (reader.text(key, `${path}.itemKeys[${index}]`, 400) && !refFromKey(key)) reader.error(path, 'khóa câu đã lộ không hợp lệ.');
  });
  if (new Set(resultIds).size !== resultIds.length || new Set(itemKeys).size !== itemKeys.length) reader.error(path, 'nguồn/câu bị trùng.');
  if(own(row,'legacyEventIds')){
    const ids=reader.array(row.legacyEventIds,`${path}.legacyEventIds`,0,100_000);
    ids.forEach((id,index)=>reader.text(id,`${path}.legacyEventIds[${index}]`,260));
    if(new Set(ids).size!==ids.length)reader.error(path,'lượt game nguồn bị trùng.');
  }
  return reader.errors.length === before ? row as unknown as ExposureSources : undefined;
}

function readResponse(value: unknown, reader: Reader, path: string): LearningResponse | undefined {
  const before = reader.errors.length;
  const base = reader.object(value, path, ['version', 'kind', 'selectedIndex', 'selectedItemId', 'chosenIndices', 'value']);
  if (!base) return;
  if (base.version !== 1) reader.error(path, 'response version chưa hỗ trợ.');
  if (base.kind === 'choice') {
    if (Object.keys(base).some(key => !['version', 'kind', 'selectedIndex'].includes(key))) reader.error(path, 'response thừa trường.');
    reader.integer(base.selectedIndex, `${path}.selectedIndex`, 0, 3);
  } else if (base.kind === 'pair') {
    if (Object.keys(base).some(key => !['version', 'kind', 'selectedItemId'].includes(key))) reader.error(path, 'response thừa trường.');
    reader.id(base.selectedItemId, `${path}.selectedItemId`);
  } else if (base.kind === 'sentence') {
    if (Object.keys(base).some(key => !['version', 'kind', 'chosenIndices'].includes(key))) reader.error(path, 'response thừa trường.');
    reader.array(base.chosenIndices, `${path}.chosenIndices`, 0, 15).forEach((index, offset) => reader.integer(index, `${path}.chosenIndices[${offset}]`, 0, 14));
  } else if (base.kind === 'text') {
    if (Object.keys(base).some(key => !['version', 'kind', 'value'].includes(key))) reader.error(path, 'response thừa trường.');
    reader.text(base.value, `${path}.value`, 4000);
  } else reader.error(path, 'dạng trả lời chưa hỗ trợ.');
  return reader.errors.length === before ? base as unknown as LearningResponse : undefined;
}

export function scoreLearningResponse(ref: PackItemRef, response: LearningResponse, packs: ContentPack[]): boolean | undefined {
  const item = findRefItem(ref, packs);
  if (!item) return;
  if (item.kind === 'multiple-choice' && response.kind === 'choice') return response.selectedIndex === (item as QuizItem).correctIndex;
  if (item.kind === 'pair' && response.kind === 'pair') return response.selectedItemId === (item as PairItem).id;
  if (item.kind === 'sentence' && response.kind === 'sentence') return isCorrectSentence((item as SentenceItem).words, response.chosenIndices);
  if((item.kind==='reading-choice'||item.kind==='listening-choice')&&response.kind==='choice')return response.selectedIndex===item.correctIndex;
  if(item.kind==='numeric-answer'&&response.kind==='text'){const number=normalizedNumber(response.value);return number===undefined?undefined:number===normalizedNumber(item.answer);}
  if((item.kind==='fill-blank'||item.kind==='listening-gap')&&response.kind==='text')return item.acceptedAnswers.some(answer=>normalizedWord(answer,item.caseSensitive)===normalizedWord(response.value,item.caseSensitive));
  return undefined;
}

export function validateLessonEvent(input: unknown, session: LearningSession, curricula: CurriculumSnapshot[], packs: ContentPack[]): string[] {
  const reader = new Reader();
  const row = reader.object(input, 'Lượt học', ['schemaVersion', 'eventId', 'attemptKey', 'sessionId', 'profileId', 'scope', 'itemRef', 'objectiveId', 'sequence',
    'submissionIndex', 'response', 'correct', 'hintsUsed', 'elapsedMs', 'occurredAt']);
  if (!row) return reader.errors;
  if (row.schemaVersion !== 1) reader.error('Lượt học', 'schema chưa hỗ trợ.');
  reader.text(row.eventId, 'Lượt học.eventId', 260);
  for (const key of ['attemptKey', 'sessionId', 'profileId', 'objectiveId']) reader.id(row[key], `Lượt học.${key}`);
  const scope = readScope(row.scope, reader, 'Lượt học.scope'), ref = readRef(row.itemRef, reader, 'Lượt học.itemRef');
  const response = readResponse(row.response, reader, 'Lượt học.response');
  reader.integer(row.sequence, 'Lượt học.sequence', 1, 4000); reader.integer(row.submissionIndex, 'Lượt học.submissionIndex', 1, 100);
  reader.boolean(row.correct, 'Lượt học.correct'); reader.integer(row.hintsUsed, 'Lượt học.hintsUsed', 0, 20);
  reader.integer(row.elapsedMs, 'Lượt học.elapsedMs', 0, 14_400_000); reader.timestamp(row.occurredAt, 'Lượt học.occurredAt');
  if (reader.errors.length || !scope || !ref || !response) return reader.errors;
  const event = row as unknown as LessonEvent;
  if(session.mode==='contest-mock'&&(event.submissionIndex!==1||event.hintsUsed!==0))reader.error('Lượt học','lượt tổng hợp chỉ nhận câu trả lời đầu tiên, không dùng gợi ý.');
  if (event.sessionId !== session.sessionId || event.profileId !== session.profileId || !sameLessonScope(scope, session.scope)
    || event.eventId !== `${session.sessionId}:${event.attemptKey}`) reader.error('Lượt học', 'danh tính/khóa lượt không khớp phiên.');
  resolveScope(scope, curricula, reader);
  if (!session.checkpoint.itemOrder.some(item => itemRefKey(item) === itemRefKey(ref))) reader.error('Lượt học', 'câu không thuộc form đã ghim.');
  const item = findRefItem(ref, packs);
  if (!item || item.objectiveId !== event.objectiveId) reader.error('Lượt học', 'câu/mục tiêu không thuộc đúng học liệu.');
  const scored = scoreLearningResponse(ref, response, packs);
  if(isAudioItem(item)){const media=audioForItem(ref,packs),played=session.checkpoint.mediaPlayback?.find(row=>row.mediaId===item.audioId&&row.sha256===media?.sha256&&Date.parse(row.completedAt)<=Date.parse(event.occurredAt));
    if(!played)reader.error('Lượt học','cần nghe clip đã kiểm tra trước khi gửi câu trả lời.');}
  if (scored === undefined || scored !== event.correct) reader.error('Lượt học', 'response/correct không khớp đáp án snapshot.');
  if (Date.parse(event.occurredAt) < Date.parse(session.startedAt) || Date.parse(event.occurredAt) > Date.parse(session.endedAt ?? session.checkpoint.updatedAt)) reader.error('Lượt học', 'thời điểm ngoài phiên/checkpoint.');
  if(session.checkpoint.deadlineAt&&(session.mode==='contest-mock'?Date.parse(event.occurredAt)>=Date.parse(session.checkpoint.deadlineAt):Date.parse(event.occurredAt)>Date.parse(session.checkpoint.deadlineAt)))reader.error('Lượt học','câu trả lời nằm sau hạn làm bài.');
  const receipt = session.checkpoint.receipts.find(receipt => receipt.eventId === event.eventId);
  if (!receipt || receipt.attemptKey !== event.attemptKey || receipt.itemKey !== itemRefKey(ref) || receipt.submissionIndex !== event.submissionIndex
    || receipt.committedAt !== event.occurredAt) reader.error('Lượt học', 'thiếu receipt commit đúng lượt.');
  return reader.errors;
}

export interface ResultValidationContext {
  curricula: CurriculumSnapshot[];
  packs: ContentPack[];
  sessions: StoredSession[];
  events: StoredEvent[];
  /** Backup scoring may read only the session's events; source lookups still use all evidence. */
  exposureEvents?: StoredEvent[];
  results: SessionResult[];
  profiles?: LearnerProfile[];
}

function findResultSource(id: string | undefined, candidates: SessionResult[], reader: Reader): SessionResult | undefined {
  if (!id) return;
  const candidate = candidates.find(value => {
    if (!value || typeof value !== 'object') return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'resultId');
    return !!descriptor && own(descriptor, 'value') && descriptor.value === id;
  });
  if (!candidate) return;
  const before = reader.errors.length;
  const row = reader.object(candidate, `Nguồn ${id}`, ['schemaVersion', 'resultId', 'sessionId', 'profileId', 'scope', 'rewardGroupId', 'mode', 'formId', 'formRevision',
    'blueprintId', 'blueprintRevision', 'completed', 'passed', 'independent', 'starTier', 'firstAttemptCorrect', 'totalItems', 'coverage', 'eventIds', 'itemKeys',
    'readStepIds', 'practiceCorrected', 'hintsUsed', 'sourcePracticeResultIds', 'sourcePassResultId', 'completedAt', 'localDay','contest']);
  if (!row) return;
  if (row.schemaVersion !== 1) reader.error(`Nguồn ${id}`, 'schema không hợp lệ.');
  reader.text(row.resultId, `Nguồn ${id}.resultId`, 160); reader.id(row.sessionId, `Nguồn ${id}.sessionId`);
  reader.id(row.profileId, `Nguồn ${id}.profileId`); const scope = readScope(row.scope, reader, `Nguồn ${id}.scope`);
  reader.enum(row.mode, `Nguồn ${id}.mode`, modes); reader.integer(row.starTier, `Nguồn ${id}.starTier`, 0, 3);
  for (const key of ['completed', 'passed', 'independent', 'practiceCorrected']) reader.boolean(row[key], `Nguồn ${id}.${key}`);
  reader.timestamp(row.completedAt, `Nguồn ${id}.completedAt`);
  if (typeof row.localDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.localDay)) reader.error(`Nguồn ${id}`, 'ngày học nguồn không hợp lệ.');
  const keys = reader.array(row.itemKeys, `Nguồn ${id}.itemKeys`, 1, 200);
  keys.forEach((value, index) => reader.text(value, `Nguồn ${id}.itemKeys[${index}]`, 400));
  if (scope && row.profileId !== scope.profileId) reader.error(`Nguồn ${id}`, 'hồ sơ nguồn không khớp scope.');
  return reader.errors.length === before ? candidate : undefined;
}

function plainData(value: unknown): value is Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && own(Object.getOwnPropertyDescriptor(value, key)!, 'value'));
}

function refFromKey(value: unknown): PackItemRef | undefined {
  if (typeof value !== 'string') return;
  let tuple: unknown;
  try { tuple = JSON.parse(value); } catch { return; }
  if (!Array.isArray(tuple) || tuple.length !== 3) return;
  const reader = new Reader();
  return readRef({ packId: tuple[0], contentVersion: tuple[1], itemId: tuple[2] }, reader, 'Câu đã lộ');
}

function priorExposedFingerprints(session: LearningSession, context: ResultValidationContext): Set<string> {
  const fingerprints = new Set<string>();
  const append = (keys: unknown) => {
    if (!Array.isArray(keys)) return;
    for (const key of keys) {
      const ref = refFromKey(key), fingerprint = ref && itemContentFingerprint(ref, context.packs);
      if (fingerprint) fingerprints.add(fingerprint);
      const contentContext=ref&&richContextFingerprint(ref,context.packs);if(contentContext)fingerprints.add(contentContext);
    }
  };
  if (session.exposureSources) {
    append(session.exposureSources.itemKeys);
    return fingerprints;
  }
  const sameProfile = (value: unknown): boolean => {
    const reader = new Reader(); const scope = readScope(value, reader, 'Scope trước');
    return !!scope && scope.profileId === session.profileId;
  };
  for (const candidate of context.results) if (plainData(candidate) && candidate.sessionId !== session.sessionId && candidate.completed === true
    && candidate.profileId === session.profileId && sameProfile(candidate.scope)
    && typeof candidate.completedAt === 'string' && Date.parse(candidate.completedAt) <= Date.parse(session.startedAt)) append(candidate.itemKeys);
  for (const candidate of context.sessions) if (plainData(candidate) && isLearningSession(candidate) && candidate.sessionId !== session.sessionId
    && candidate.profileId === session.profileId && sameProfile(candidate.scope) && plainData(candidate.checkpoint) && typeof candidate.checkpoint.updatedAt === 'string'
    && Date.parse(candidate.checkpoint.updatedAt) <= Date.parse(session.startedAt)){append(candidate.checkpoint.exposedItemKeys);append(playedAudioItemRefs(candidate,context.packs,session.startedAt).map(itemRefKey));}
  for(const event of context.exposureEvents??context.events)if(plainData(event)&&!isLessonEvent(event)&&(event.profileId??'default-learner')===session.profileId
    &&Date.parse(event.occurredAt)<=Date.parse(session.startedAt))append([itemRefKey({packId:event.packId,contentVersion:event.contentVersion,itemId:event.itemId})]);
  return fingerprints;
}

export function independentFormIsAvailable(session: LearningSession, context: ResultValidationContext): boolean {
  const exposed = priorExposedFingerprints(session, context);
  return session.checkpoint.itemOrder.every(ref => {
    const fingerprint = itemContentFingerprint(ref, context.packs);
    const contentContext=richContextFingerprint(ref,context.packs);
    return !!fingerprint && !exposed.has(fingerprint)&&(!contentContext||!exposed.has(contentContext));
  });
}

/** The host takes this snapshot from committed storage, never from a component. */
export function captureExposureSources(session: Pick<LearningSession, 'sessionId' | 'profileId' | 'startedAt'>,
  context: { results: SessionResult[]; sessions: StoredSession[]; events?:StoredEvent[];packs?:ContentPack[] }): ExposureSources {
  const resultIds = new Set<string>(), sessionIds = new Set<string>(), itemKeys = new Set<string>(),legacyEventIds=new Set<string>();
  const append = (keys: unknown) => {
    if (!Array.isArray(keys)) return;
    for (const key of keys) if (typeof key === 'string' && refFromKey(key)) itemKeys.add(key);
  };
  const sameProfile = (value: unknown): boolean => {
    const reader = new Reader(); const scope = readScope(value, reader, 'Scope trước');
    return !!scope && scope.profileId === session.profileId;
  };
  for (const result of context.results) if (plainData(result) && result.sessionId !== session.sessionId && result.profileId === session.profileId
    && sameProfile(result.scope) && result.completed === true && typeof result.completedAt === 'string'
    && Date.parse(result.completedAt) <= Date.parse(session.startedAt) && typeof result.resultId === 'string') {
    resultIds.add(result.resultId); append(result.itemKeys);
  }
  for (const prior of context.sessions) if (plainData(prior) && isLearningSession(prior) && prior.sessionId !== session.sessionId
    && prior.profileId === session.profileId && sameProfile(prior.scope) && typeof prior.startedAt === 'string'
    && Date.parse(prior.startedAt) <= Date.parse(session.startedAt) && plainData(prior.checkpoint)
    && Array.isArray(prior.checkpoint.exposedItemKeys)) {
    const listened=playedAudioItemRefs(prior,context.packs??[],session.startedAt).map(itemRefKey);
    if(prior.checkpoint.exposedItemKeys.length||listened.length){sessionIds.add(prior.sessionId);append(prior.checkpoint.exposedItemKeys);append(listened);}
  }
  for(const event of context.events??[])if(plainData(event)&&!isLessonEvent(event)&&(event.profileId??'default-learner')===session.profileId
    &&Date.parse(event.occurredAt)<=Date.parse(session.startedAt)){
    legacyEventIds.add(event.eventId);append([itemRefKey({packId:event.packId,contentVersion:event.contentVersion,itemId:event.itemId})]);
  }
  return { resultIds: [...resultIds].sort(), sessionIds: [...sessionIds].sort(), itemKeys: [...itemKeys].sort(),...(legacyEventIds.size?{legacyEventIds:[...legacyEventIds].sort()}:{}) };
}

type ExposureContext=Pick<ResultValidationContext,'results'|'sessions'>&Partial<Pick<ResultValidationContext,'events'|'exposureEvents'|'packs'>>;
function validateExposureSourceGraph(session: LearningSession, context: ExposureContext, reader: Reader): void {
  if (!session.exposureSources) return;
  const snapshot = readExposureSources(session.exposureSources, reader);
  if (!snapshot) return;
  const knownKeys = new Set<string>();
  for (const id of snapshot.resultIds) {
    const source = findResultSource(id, context.results, reader);
    if (!source || source.sessionId === session.sessionId || source.profileId !== session.profileId || source.scope.profileId !== session.profileId
      || !source.completed || Date.parse(source.completedAt) > Date.parse(session.startedAt)) {
      reader.error('Cơ sở câu đã lộ', 'kết quả nguồn thiếu/sai hồ sơ hoặc xảy ra sau lúc tạo phiên.'); continue;
    }
    source.itemKeys.forEach(key => knownKeys.add(key));
  }
  for (const id of snapshot.sessionIds) {
    const source = context.sessions.find(candidate => plainData(candidate) && candidate.sessionId === id);
    if (!source || !isLearningSession(source) || source.sessionId === session.sessionId || source.profileId !== session.profileId
      || !plainData(source.scope) || source.scope.profileId !== session.profileId || typeof source.startedAt !== 'string'
      || Date.parse(source.startedAt) > Date.parse(session.startedAt) || !plainData(source.checkpoint) || !Array.isArray(source.checkpoint.exposedItemKeys)) {
      reader.error('Cơ sở câu đã lộ', 'phiên nguồn thiếu/sai hồ sơ hoặc bắt đầu sau lúc tạo phiên.'); continue;
    }
    source.checkpoint.exposedItemKeys.forEach(key => { if (typeof key === 'string') knownKeys.add(key); });
    for(const ref of playedAudioItemRefs(source,context.packs??[],session.startedAt))knownKeys.add(itemRefKey(ref));
  }
  for(const id of snapshot.legacyEventIds??[]){
    const event=(context.exposureEvents??context.events??[]).find(row=>row.eventId===id),source=event&&context.sessions.find(row=>row.sessionId===event.sessionId);
    if(!event||isLessonEvent(event)||!source||isLearningSession(source)||(event.profileId??'default-learner')!==session.profileId
      ||(source.profileId??'default-learner')!==session.profileId||event.packId!==source.packId||event.contentVersion!==source.contentVersion
      ||Date.parse(event.occurredAt)>Date.parse(session.startedAt)||Date.parse(event.occurredAt)<Date.parse(source.startedAt)){
      reader.error('Cơ sở câu đã lộ','lượt game nguồn thiếu/sai hồ sơ, câu hoặc thời điểm.');continue;
    }
    knownKeys.add(itemRefKey({packId:event.packId,contentVersion:event.contentVersion,itemId:event.itemId}));
  }
  if (snapshot.itemKeys.some(key => !knownKeys.has(key))) reader.error('Cơ sở câu đã lộ', 'câu đã lộ không được chứng minh bởi nguồn snapshot.');
}

/** Also used to validate unfinished sessions during backup/restore. */
export function validateSessionExposureSources(session: LearningSession, context: ExposureContext): string[] {
  const reader = new Reader(); validateExposureSourceGraph(session, context, reader); return reader.errors;
}

export function validateSessionResult(input: unknown, context: ResultValidationContext): string[] {
  const reader = new Reader();
  const row = reader.object(input, 'Kết quả', ['schemaVersion', 'resultId', 'sessionId', 'profileId', 'scope', 'rewardGroupId', 'mode', 'formId', 'formRevision',
    'blueprintId', 'blueprintRevision', 'completed', 'passed', 'independent', 'starTier', 'firstAttemptCorrect', 'totalItems', 'coverage', 'eventIds', 'itemKeys',
    'readStepIds', 'practiceCorrected', 'hintsUsed', 'sourcePracticeResultIds', 'sourcePassResultId', 'completedAt', 'localDay','contest']);
  if (!row) return reader.errors;
  if (row.schemaVersion !== 1) reader.error('Kết quả', 'schema chưa hỗ trợ.');
  reader.text(row.resultId, 'Kết quả.resultId', 160);
  for (const key of ['sessionId', 'profileId', 'rewardGroupId', 'formId', 'blueprintId']) reader.id(row[key], `Kết quả.${key}`);
  for (const key of ['formRevision', 'blueprintRevision']) reader.integer(row[key], `Kết quả.${key}`);
  const scope = readScope(row.scope, reader, 'Kết quả.scope'); reader.enum(row.mode, 'Kết quả.mode', modes);
  for (const key of ['completed', 'passed', 'independent', 'practiceCorrected']) reader.boolean(row[key], `Kết quả.${key}`);
  reader.integer(row.starTier, 'Kết quả.starTier', 0, 3); reader.integer(row.firstAttemptCorrect, 'Kết quả.firstAttemptCorrect', 0, 200);
  reader.integer(row.totalItems, 'Kết quả.totalItems', 1, 200); reader.integer(row.hintsUsed, 'Kết quả.hintsUsed', 0, 80_000);
  reader.ids(row.readStepIds, 'Kết quả.readStepIds', 0, 30);
  const eventIds = reader.array(row.eventIds, 'Kết quả.eventIds', row.mode==='contest-mock'?0:1, 4000), itemKeys = reader.array(row.itemKeys, 'Kết quả.itemKeys', 1, 200);
  eventIds.forEach((id, index) => reader.text(id, `Kết quả.eventIds[${index}]`, 260)); itemKeys.forEach((id, index) => reader.text(id, `Kết quả.itemKeys[${index}]`, 400));
  if (new Set(eventIds).size !== eventIds.length || new Set(itemKeys).size !== itemKeys.length) reader.error('Kết quả', 'event/item bị trùng.');
  const sourceIds = reader.array(row.sourcePracticeResultIds, 'Kết quả.sourcePracticeResultIds', 0, 100);
  sourceIds.forEach((id, index) => reader.text(id, `Kết quả.sourcePracticeResultIds[${index}]`, 160));
  if (new Set(sourceIds).size !== sourceIds.length) reader.error('Kết quả', 'kết quả luyện nguồn bị trùng.');
  if (own(row, 'sourcePassResultId')) reader.text(row.sourcePassResultId, 'Kết quả.sourcePassResultId', 160);
  reader.timestamp(row.completedAt, 'Kết quả.completedAt');
  if (typeof row.localDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.localDay)) reader.error('Kết quả.localDay', 'ngày địa phương không hợp lệ.');
  const coverageIds: unknown[] = [];
  reader.array(row.coverage, 'Kết quả.coverage', 1, 30).forEach((value, index) => {
    const coverage = reader.object(value, `Coverage[${index}]`, ['objectiveId', 'answered', 'firstAttemptCorrect']);
    if (!coverage) return;
    reader.id(coverage.objectiveId, `Coverage[${index}].objectiveId`); reader.integer(coverage.answered, `Coverage[${index}].answered`, 0, 200);
    reader.integer(coverage.firstAttemptCorrect, `Coverage[${index}].firstAttemptCorrect`, 0, 200); coverageIds.push(coverage.objectiveId);
  });
  if (new Set(coverageIds).size !== coverageIds.length) reader.error('Coverage', 'mục tiêu trùng.');
  if(own(row,'contest')){const summary=reader.object(row.contest,'Kết quả tổng hợp',['presetId','presetRevision','score','maxScore','elapsedMs','finishReason','skippedItemKeys','unansweredItemKeys']);if(summary){
    reader.id(summary.presetId,'Kết quả tổng hợp.presetId');reader.integer(summary.presetRevision,'Kết quả tổng hợp.presetRevision');reader.integer(summary.score,'Kết quả tổng hợp.score',0,200_000);reader.integer(summary.maxScore,'Kết quả tổng hợp.maxScore',1,200_000);reader.integer(summary.elapsedMs,'Kết quả tổng hợp.elapsedMs',0,7_200_000);
    reader.enum(summary.finishReason,'Kết quả tổng hợp.finishReason',new Set(['completed','submitted','timeout']));for(const field of ['skippedItemKeys','unansweredItemKeys'])reader.array(summary[field],`Kết quả tổng hợp.${field}`,0,200).forEach((key,index)=>reader.text(key,`Kết quả tổng hợp.${field}[${index}]`,400));
  }}
  if (reader.errors.length || !scope) return reader.errors;
  const result = row as unknown as SessionResult;
  if (result.resultId !== sessionResultId(result.sessionId) || result.profileId !== scope.profileId) reader.error('Kết quả', 'ID/profile không khớp nguồn tất định.');
  if (result.localDay !== vietnamLearningDay(result.completedAt)) reader.error('Kết quả', 'ngày học không khớp Asia/Ho_Chi_Minh.');
  const session = context.sessions.find(session => plainData(session) && session.sessionId === result.sessionId);
  if (!session || !isLearningSession(session)) { reader.error('Kết quả', 'không có phiên bài học; lịch sử legacy không cấp sao.'); return reader.errors; }
  const sessionErrors = validateLearningSession(session, context.curricula, context.packs, context.profiles);
  sessionErrors.forEach(error => reader.error('Kết quả', error));
  if (sessionErrors.length) return reader.errors;
  const resolved = resolveScope(scope, context.curricula, reader);
  if (!resolved) return reader.errors;
  validateExposureSourceGraph(session, context, reader);
  if (!sameLessonScope(scope, session.scope) || result.mode !== session.mode || result.rewardGroupId !== session.rewardGroupId
    || result.formId !== session.formId || result.formRevision !== session.formRevision || result.blueprintId !== session.blueprint.blueprintId
    || result.blueprintRevision !== session.blueprint.revision || session.status !== 'completed' || session.endedAt !== result.completedAt) reader.error('Kết quả', 'metadata/thời điểm không khớp phiên đã hoàn tất.');
  const events = context.events.filter((event): event is LessonEvent => isLessonEvent(event) && event.sessionId === session.sessionId).sort((a, b) => a.sequence - b.sequence);
  const eventErrors = events.flatMap(event => validateLessonEvent(event, session, context.curricula, context.packs));
  eventErrors.forEach(error => reader.error('Kết quả', error));
  if (eventErrors.length) return reader.errors;
  if (JSON.stringify(events.map(event => event.eventId).sort()) !== JSON.stringify([...result.eventIds].sort())) reader.error('Kết quả', 'eventIds không khớp toàn bộ evidence phiên.');
  if (JSON.stringify(session.checkpoint.receipts.map(receipt => receipt.eventId).sort()) !== JSON.stringify(events.map(event => event.eventId).sort())) reader.error('Kết quả', 'checkpoint có receipt thừa hoặc thiếu evidence commit.');
  const first = new Map<string, LessonEvent>(), latest = new Map<string, LessonEvent>();
  let hints = 0;
  events.forEach((event, index) => {
    const key = itemRefKey(event.itemRef);
    if (event.sequence !== index + 1 || event.submissionIndex !== (latest.get(key)?.submissionIndex ?? 0) + 1) reader.error('Kết quả', 'thứ tự event/submission không liên tục.');
    if (!first.has(key)) first.set(key, event);
    latest.set(key, event); hints += event.hintsUsed;
  });
  const expectedKeys = session.checkpoint.itemOrder.map(itemRefKey).sort();
  if (JSON.stringify(expectedKeys) !== JSON.stringify([...result.itemKeys].sort()) || result.mode!=='contest-mock'&&first.size !== expectedKeys.length || result.totalItems !== expectedKeys.length) reader.error('Kết quả', 'thiếu câu đã nộp hoặc sai tổng blueprint.');
  const correct = [...first.values()].filter(event => event.correct).length;
  if (result.firstAttemptCorrect !== correct || result.hintsUsed !== hints) reader.error('Kết quả', 'điểm lần đầu/gợi ý không khớp event.');
  const actualCoverage = session.blueprint.objectives.map(objective => ({ objectiveId: objective.objectiveId,
    answered: [...first.values()].filter(event => event.objectiveId === objective.objectiveId).length,
    firstAttemptCorrect: [...first.values()].filter(event => event.objectiveId === objective.objectiveId && event.correct).length })).sort((a, b) => a.objectiveId.localeCompare(b.objectiveId));
  if (JSON.stringify(actualCoverage) !== JSON.stringify([...result.coverage].sort((a, b) => a.objectiveId.localeCompare(b.objectiveId)))) reader.error('Kết quả', 'coverage không khớp câu đã nộp.');
  const fullCoverage = first.size === expectedKeys.length && session.blueprint.objectives.every(objective =>
    (actualCoverage.find(entry => entry.objectiveId === objective.objectiveId)?.answered ?? 0) >= objective.minimumItems);
  const allRead = resolved.lesson.steps.every(step => result.readStepIds.includes(step.stepId));
  const corrected = latest.size === expectedKeys.length && [...latest.values()].every(event => event.correct);
  if (result.completed !== (result.mode==='contest-mock'||fullCoverage) || result.practiceCorrected !== corrected
    || JSON.stringify([...result.readStepIds].sort()) !== JSON.stringify([...session.checkpoint.readStepIds].sort())) reader.error('Kết quả', 'trạng thái hoàn thành/sửa lỗi/bước đọc không khớp evidence.');
  const independentMode = result.mode === 'lesson-assessment' || result.mode === 'lesson-review';
  const exposed = priorExposedFingerprints(session, context);
  const previouslyExposed = session.checkpoint.itemOrder.some(ref => {const contentContext=richContextFingerprint(ref,context.packs);return exposed.has(itemContentFingerprint(ref, context.packs)!)||!!contentContext&&exposed.has(contentContext);});
  const independent = independentMode && hints === 0 && events.length === first.size && session.checkpoint.exposedItemKeys.length === 0 && !previouslyExposed;
  if (result.independent !== independent) reader.error('Kết quả', 'evidence độc lập không hợp lệ.');
  if (JSON.stringify([...result.sourcePracticeResultIds].sort()) !== JSON.stringify([...session.sourcePracticeResultIds].sort()) || result.sourcePassResultId !== session.sourcePassResultId) reader.error('Kết quả', 'tham chiếu nguồn khác phiên.');
  const practiceSources = result.sourcePracticeResultIds.map(id => findResultSource(id, context.results, reader));
  for (const source of practiceSources) if (!source || source.resultId === result.resultId || !sameLessonScope(source.scope, scope)
    || source.mode !== 'lesson-practice' || source.starTier !== 1 || !source.completed || !source.practiceCorrected
    || Date.parse(source.completedAt) > Date.parse(session.startedAt)) reader.error('Kết quả', 'nguồn luyện thiếu/sai scope hoặc chưa hoàn thành trước phiên.');
  const independentPass = independent && fullCoverage && result.totalItems >= resolved.policy.minIndependentItems
    && correct * 100 >= result.totalItems * resolved.policy.passPercent;
  let expectedTier: StarTier = 0, expectedPassed = false;
  if (result.mode === 'lesson-practice' && fullCoverage && allRead && corrected) expectedTier = 1;
  if (result.mode === 'lesson-assessment' && independentPass && practiceSources.length > 0 && practiceSources.every(Boolean)) { expectedTier = 2; expectedPassed = true; }
  if (result.mode === 'lesson-review') {
    const source = findResultSource(result.sourcePassResultId, context.results, reader);
    const validSource = !!source && source.resultId !== result.resultId && sameLessonScope(source.scope, scope) && source.mode === 'lesson-assessment'
      && source.starTier === 2 && source.passed && source.independent && Date.parse(source.completedAt) <= Date.parse(session.startedAt)
      && Date.parse(session.startedAt) - Date.parse(source.completedAt) >= resolved.policy.reviewDelayHours * 3_600_000
      && vietnamLearningDay(session.startedAt) !== source.localDay && !result.itemKeys.some(key => source.itemKeys.includes(key));
    if (!source || !validSource) reader.error('Kết quả', 'nguồn pass/scope/form/mốc 24 giờ hoặc ngày ôn không hợp lệ.');
    if (independentPass && validSource) { expectedTier = 3; expectedPassed = true; }
  }
  if (result.starTier !== expectedTier || result.passed !== expectedPassed) reader.error('Kết quả', 'sao/passed không có đủ evidence theo policy.');
  if(result.mode==='contest-mock'){
    for(const error of contestPrerequisiteErrors(session,context))reader.error('Kết quả tổng hợp',error);
    const preset=resolved.curriculum.contestPreset;
    const canonical=(summary:NonNullable<SessionResult['contest']>)=>JSON.stringify(Object.entries({...summary,skippedItemKeys:[...summary.skippedItemKeys].sort(),unansweredItemKeys:[...summary.unansweredItemKeys].sort()}).sort(([a],[b])=>a.localeCompare(b)));
    if(!preset||!result.contest||canonical(result.contest)!==canonical(contestSummary(session,events,result.completedAt,preset)))reader.error('Kết quả tổng hợp','điểm/thời gian/câu bỏ qua/chưa làm không khớp evidence.');
  }else if(result.contest)reader.error('Kết quả','metadata tổng hợp nằm ngoài mode tương ứng.');
  return reader.errors;
}

/** Call only after validating the immutable result graph. No legacy row grants stars. */
export function rebuildLessonProgress(results: SessionResult[], curricula: CurriculumSnapshot[]): LessonProgress[] {
  const grouped = new Map<string, SessionResult[]>();
  for (const result of results) {
    const key = lessonScopeKey(result.scope);
    const rows = grouped.get(key) ?? []; rows.push(result); grouped.set(key, rows);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([progressId, rows]) => {
    rows.sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.resultId.localeCompare(b.resultId));
    const latest = rows[rows.length - 1], pass = rows.find(row => row.starTier === 2 && row.passed), review = rows.find(row => row.starTier === 3 && row.passed);
    const policy = curricula.find(row => row.curriculumId === latest.scope.curriculumId && row.revision === latest.scope.curriculumRevision)
      ?.policies.find(row => row.policyId === latest.scope.policyId && row.revision === latest.scope.policyRevision);
    return {
      schemaVersion: 1, progressId, profileId: latest.profileId, scope: { ...latest.scope }, rewardGroupId: latest.rewardGroupId,
      bestStars: Math.max(...rows.map(row => row.starTier)) as StarTier, passed: rows.some(row => row.passed && row.starTier >= 2),
      resultIds: rows.map(row => row.resultId).sort(), sourcePracticeResultIds: [...new Set(rows.flatMap(row => row.mode === 'lesson-practice' && row.starTier === 1 ? [row.resultId] : row.sourcePracticeResultIds))].sort(),
      ...(pass ? { sourcePassResultId: pass.resultId, reviewEligibleAt: new Date(Date.parse(pass.completedAt) + (policy?.reviewDelayHours ?? 24) * 3_600_000).toISOString() } : {}),
      ...(review ? { sourceReviewResultId: review.resultId } : {}), updatedAt: latest.completedAt,
    };
  });
}

export function totalRewardStars(progress: LessonProgress[], profileId: string): number {
  const rewards = new Map<string, number>();
  for (const row of progress) if (row.profileId === profileId) rewards.set(row.rewardGroupId, Math.max(rewards.get(row.rewardGroupId) ?? 0, row.bestStars));
  return [...rewards.values()].reduce((total, stars) => total + stars, 0);
}
