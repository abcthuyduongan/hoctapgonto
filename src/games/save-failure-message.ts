/** Preserve host guidance without suggesting that a failed save requires deleting data. */
export function saveFailureMessage(failure:unknown){
  if(failure instanceof Error&&failure.name==='OnlineError')return failure.message;
  return 'Chưa lưu được lượt này. Con giữ trang đang mở và thử lại. Nếu vẫn gặp lỗi, nhờ người lớn kiểm tra; dữ liệu đã lưu được giữ nguyên.';
}
