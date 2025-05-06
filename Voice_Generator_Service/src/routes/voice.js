const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const authMiddleware = require('../middleware/auth');
const Voice = require('../models/Voice');

// Cấu hình multer để xử lý file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file audio'));
    }
  }
});

// Route upload file giọng nói
router.post('/upload', authMiddleware, upload.single('voice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file audio'
      });
    }

    // Upload lên Cloudinary
    const result = await cloudinary.uploader.upload_stream({
      resource_type: 'video',
      folder: 'voices',
      format: 'mp3'
    }, async (error, result) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi upload file lên Cloudinary',
          error: error.message
        });
      }

      // Lưu thông tin vào MongoDB
      const voice = new Voice({
        name: req.body.name || req.file.originalname,
        description: req.body.description,
        url: result.secure_url,
        publicId: result.public_id,
        duration: result.duration,
        format: result.format,
        size: result.bytes,
        createdBy: req.user._id
      });

      await voice.save();

      res.status(201).json({
        success: true,
        message: 'Upload file thành công',
        data: voice
      });
    }).end(req.file.buffer);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

module.exports = router; 