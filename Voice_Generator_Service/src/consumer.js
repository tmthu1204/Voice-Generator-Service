const amqp = require('amqplib');
const voiceService = require('./services/voiceService');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'voice_generate_queue';

// Lưu trữ các kết nối socket theo job_id
const socketConnections = new Map();

// Hàm để đăng ký socket connection
function registerSocket(jobId, socket) {
    socketConnections.set(jobId, socket);
    console.log(`Client đã đăng ký theo dõi job: ${jobId}`);
}

// Hàm để hủy đăng ký socket connection
function unregisterSocket(jobId) {
    socketConnections.delete(jobId);
    console.log(`Client đã hủy theo dõi job: ${jobId}`);
}

async function startConsumer() {
    try {
        // Kết nối tới RabbitMQ
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        // Đảm bảo queue tồn tại
        await channel.assertQueue(QUEUE_NAME, {
            durable: true
        });

        console.log('Đang chờ message từ queue:', QUEUE_NAME);

        // Xử lý message
        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                try {
                    const content = JSON.parse(msg.content.toString());
                    console.log('Nhận message:', content);

                    const processedSegments = [];

                    // Xử lý từng segment với voice style tương ứng
                    for (const segment of content.segments) {
                        const result = await voiceService.synthesize({
                            job_id: content.job_id,
                            voice_styles: content.voice_styles,
                            segments: [segment]
                        });

                        processedSegments.push({
                            index: segment.index,
                            script: segment.text,
                            audio: result.segments[0].audio,
                            duration: result.segments[0].duration
                        });
                    }

                    // Gửi kết quả qua WebSocket
                    const socket = socketConnections.get(content.job_id);
                    
                    if (socket) {
                        socket.emit('voice_generation_complete', {
                            job_id: content.job_id,
                            segments: processedSegments
                        });
                        console.log(`Đã gửi kết quả cho job ${content.job_id}`);
                    } else {
                        console.log(`Không tìm thấy client đang theo dõi job ${content.job_id}`);
                    }

                    // Xác nhận đã xử lý message thành công
                    channel.ack(msg);
                } catch (error) {
                    console.error('Lỗi khi xử lý message:', error);
                    // Nếu xử lý thất bại, message sẽ được đưa vào dead letter queue
                    channel.nack(msg, false, false);
                }
            }
        });

        // Xử lý khi đóng kết nối
        process.on('SIGINT', async () => {
            await channel.close();
            await connection.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('Lỗi kết nối RabbitMQ:', error);
        throw error;
    }
}

module.exports = { 
    startConsumer,
    registerSocket,
    unregisterSocket
}; 