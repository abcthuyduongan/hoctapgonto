export class OnlineError extends Error {
  constructor(status, message) { super(message); this.name = 'OnlineError'; this.status = status; }
}
export const fail = (status, message) => { throw new OnlineError(status, message); };
export const text = (value, label, max = 120) => {
  if(value===null||typeof value==='string'&&/^null$/i.test(value.trim()))fail(400,`${label}: thiếu dữ liệu (null).`);
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/u.test(value)) fail(400, `${label} không hợp lệ.`);
  return value.trim();
};
export const integer = (value, label, min = 1, max = 1000000) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(400, `${label} không hợp lệ.`);
  return value;
};
export function shape(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail(400, 'Dữ liệu gửi lên có trường không được hỗ trợ.');
  return value;
}
