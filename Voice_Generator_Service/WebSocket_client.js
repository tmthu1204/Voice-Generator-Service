// Kết nối tới WebSocket server
const socket = io('http://localhost:3000');

// Đăng ký theo dõi một job cụ thể
socket.emit('subscribe_job', 'job_id_2');

// Lắng nghe kết quả
socket.on('voice_generation_complete', (data) => {
  console.log('Nhận kết quả:', data);
  // data sẽ có dạng:
  // {
  //   job_id: "job_id_2",
  //   segments: [
  //     {
  //       index: "0",
  //       script: "Hé lô, đây là team tạo video tự động bằng AI của bé Uyên",
  //       audio: "https://res.cloudinary.com/...",
  //       duration: 4.344
  //     },
  //     ...
  //   ]
  // }
});