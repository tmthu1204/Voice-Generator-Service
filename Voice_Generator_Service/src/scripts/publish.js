const amqp = require('amqplib');
require('dotenv').config();
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'voice_generate_queue';

async function publishMessage() {
    let connection;
    try {
        console.log('Đang kết nối tới RabbitMQ tại:', RABBITMQ_URL);
        
        // Kết nối tới RabbitMQ
        connection = await amqp.connect(RABBITMQ_URL);
        console.log('Đã kết nối thành công tới RabbitMQ');

        const channel = await connection.createChannel();
        console.log('Đã tạo channel thành công');

        // Đảm bảo queue tồn tại
        await channel.assertQueue(QUEUE_NAME, {
            durable: true
        });
        console.log('Đã tạo/kiểm tra queue:', QUEUE_NAME);

        // Tạo message test
        const testMessage = {
            job_id: "test_job_1746657805183",
            voice_styles: {
                style: "Standard",
                gender: "FEMALE",
                language: "vi-VN"
            },
            segments: [
                {
                    index: 0,
                    text: "Hé lô, đây là team tạo video tự động bằng AI của bé Uyên"
                },
                {
                    index: 1,
                    text: "Test lần 2 nè!"
                }
            ]
        };

        // Gửi message vào queue
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(testMessage)));
        console.log('Đã gửi message:', testMessage);

        // Đóng kết nối sau 1 giây
        setTimeout(async () => {
            try {
                await channel.close();
                await connection.close();
                console.log('Đã đóng kết nối thành công');
                process.exit(0);
            } catch (closeError) {
                console.error('Lỗi khi đóng kết nối:', closeError);
                process.exit(1);
            }
        }, 1000);

    } catch (error) {
        console.error('Lỗi khi gửi message:', error);
        if (error.code === 'ECONNREFUSED') {
            console.error('\nKhông thể kết nối tới RabbitMQ. Vui lòng kiểm tra:');
            console.error('1. RabbitMQ đã được cài đặt chưa?');
            console.error('2. RabbitMQ service đang chạy chưa?');
            console.error('3. Port 5672 có đang mở không?');
            console.error('4. URL kết nối có đúng không? (hiện tại:', RABBITMQ_URL, ')');
        }
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Lỗi khi đóng kết nối:', closeError);
            }
        }
        process.exit(1);
    }
}

// Chạy hàm publish
publishMessage(); 