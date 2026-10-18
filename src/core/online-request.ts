export class OnlineRequestTimeoutError extends Error {
  constructor(){super('Máy chủ phản hồi quá lâu. Kiểm tra kết nối rồi thử lại; kết quả chỉ được xác nhận khi máy chủ trả lời.');this.name='OnlineRequestTimeoutError';}
}

/** Keep the deadline active through body decoding, not only until headers arrive. */
export async function withOnlineDeadline<T>(action:(signal:AbortSignal)=>Promise<T>,timeoutMs=30_000):Promise<T>{
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{reject(new OnlineRequestTimeoutError());controller.abort();},timeoutMs);});
  try{return await Promise.race([action(controller.signal),deadline]);}
  finally{clearTimeout(timer);}
}
