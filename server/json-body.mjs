import {gunzip} from 'node:zlib';
import {promisify} from 'node:util';
import {fail} from './online-errors.mjs';
const inflate=promisify(gunzip);

/** Both encoded and decoded bodies obey the same endpoint budget. */
export async function parseJsonBody(bytes,encoding,maxBytes){
  if(bytes.length>maxBytes)fail(413,'Gói dữ liệu vượt giới hạn kích thước.');
  const format=String(encoding??'identity').trim().toLowerCase();
  if(!['','identity','gzip'].includes(format))fail(415,'Định dạng nén dữ liệu chưa được hỗ trợ.');
  if(format==='gzip'){
    try{bytes=await inflate(bytes,{maxOutputLength:maxBytes});}
    catch(error){if(error?.code==='ERR_BUFFER_TOO_LARGE')fail(413,'Gói dữ liệu sau giải nén vượt giới hạn kích thước.');fail(400,'Gói dữ liệu nén không đọc được. Hãy thử lại.');}
  }
  let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{fail(400,'Dữ liệu JSON không đọc được.');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Dữ liệu gửi lên cần là một đối tượng JSON.');
  return value;
}
