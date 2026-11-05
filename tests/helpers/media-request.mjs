import {gunzipSync} from 'node:zlib';
export function mediaRequestBody(request){
  const bytes=request.postDataBuffer();
  return JSON.parse((request.headers()['content-encoding']==='gzip'?gunzipSync(bytes,{maxOutputLength:12*1024*1024}):bytes).toString('utf8'));
}
