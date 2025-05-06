const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');
const multer = require('multer');

// Cấu hình multer để upload file giọng nói
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file audio'));
    }
  }
});

// Tổng hợp giọng nói từ văn bản
router.post('/synthesize', voiceController.synthesizeVoice);

// Lấy bản nghe thử giọng nói
router.get('/preview', voiceController.getVoicePreview);

// Lấy danh sách giọng nói theo engine & ngôn ngữ
router.get('/list', async (req, res) => {
  try {
    const { engine, language } = req.query;
    
    if (!engine) {
      return res.status(400).json({
        success: false,
        message: 'Engine parameter is required'
      });
    }

    const result = await voiceController.getVoicesList(engine, language);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error in /list route:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get voices list',
      error: err.message
    });
  }
});

// Upload giọng nói người dùng
router.post('/upload', upload.single('file'), (req, res, next) => {
  if (req.file) {
    next();
  } else {
    res.status(400).json({
      success: false,
      message: 'Lỗi upload file',
      error: 'Không tìm thấy file'
    });
  }
}, voiceController.uploadUserVoice);

// Xoá giọng nói
router.delete('/:voiceId', voiceController.deleteVoice);

module.exports = router;
