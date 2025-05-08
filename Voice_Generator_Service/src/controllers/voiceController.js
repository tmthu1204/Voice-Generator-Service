const connectVoiceDB = require('../db');
const Voice = require('../models/Voice');

// Khởi tạo kết nối & model
let VoiceModel;

(async () => {
  const conn = await connectVoiceDB();
  VoiceModel = Voice(conn);
})().catch(err => {
  console.error('Error initializing Voice model:', err);
});

// Middleware/Service các xử lý logic tổng hợp, preview, upload... (giả sử đã có)
const voiceService = require('../services/voiceService'); // Giữ nguyên tên, bạn có thể chỉnh trong service

exports.synthesizeVoice = async (req, res) => {
  try {
    // Lấy userId từ req.user (được set bởi middleware auth)
    console.log(req.user);
    const userId = req.user._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực người dùng'
      });
    }

    const { 
      job_id,
      voice_styles,
      segments
    } = req.body;

    // Validate required fields
    if (!job_id || !voice_styles || !segments) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu các trường bắt buộc: job_id, voice_styles, segments' 
      });
    }

    // Validate voice_styles object
    if (!voice_styles.style || !voice_styles.gender || !voice_styles.language) {
      return res.status(400).json({
        success: false,
        message: 'voice_styles phải có đầy đủ các trường: style, gender, language'
      });
    }

    // Validate voice_styles values
    const validStyles = ['Standard', 'Expressive', 'Professional'];
    const validGenders = ['MALE', 'FEMALE'];
    const validLanguages = ['en-US', 'vi-VN'];

    if (!validStyles.includes(voice_styles.style)) {
      return res.status(400).json({
        success: false,
        message: `style phải là một trong các giá trị: ${validStyles.join(', ')}`
      });
    }

    if (!validGenders.includes(voice_styles.gender)) {
      return res.status(400).json({
        success: false,
        message: `gender phải là một trong các giá trị: ${validGenders.join(', ')}`
      });
    }

    if (!validLanguages.includes(voice_styles.language)) {
      return res.status(400).json({
        success: false,
        message: `language phải là một trong các giá trị: ${validLanguages.join(', ')}`
      });
    }

    // Validate segments array
    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'segments phải là một mảng không rỗng'
      });
    }

    // Validate each segment object
    for (const segment of segments) {
      if (typeof segment.index !== 'number' || !segment.text) {
        return res.status(400).json({
          success: false,
          message: 'Mỗi segment phải có đầy đủ các trường: index (number), text (string)'
        });
      }
    }

    const result = await voiceService.synthesize({
      job_id,
      voice_styles,
      segments
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Lỗi khi tổng hợp giọng nói:', err);
    res.status(500).json({ 
      success: false,
      message: 'Không thể tạo giọng nói',
      error: err.message 
    });
  }
};

exports.getVoicePreview = async (req, res) => {
  try {
    const { gender, style, language } = req.query;

    if (!gender || !style || !language) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu các tham số bắt buộc: gender, style, hoặc language' 
      });
    }

    // Validate gender and style values
    const validStyles = ['Standard', 'Expressive', 'Professional'];
    const validGenders = ['MALE', 'FEMALE'];
    const validLanguages = ['en-US', 'vi-VN'];

    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: `gender phải là một trong các giá trị: ${validGenders.join(', ')}`
      });
    }

    if (!validStyles.includes(style)) {
      return res.status(400).json({
        success: false,
        message: `style phải là một trong các giá trị: ${validStyles.join(', ')}`
      });
    }

    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: `language phải là một trong các giá trị: ${validLanguages.join(', ')}`
      });
    }

    const sample = await voiceService.getPreview(gender, style, language);
    res.status(200).json(sample);
  } catch (err) {
    console.error('Lỗi khi lấy preview giọng nói:', err);
    res.status(500).json({ 
      success: false,
      message: 'Không thể lấy bản nghe thử',
      error: err.message 
    });
  }
};

exports.getVoicesList = async (engine, language) => {
  try {
    const voices = await voiceService.getVoices(engine, language);
    return {
      success: true,
      data: voices
    };
  } catch (err) {
    console.error('Lỗi khi lấy danh sách giọng nói:', err);
    throw {
      success: false,
      message: 'Không thể lấy danh sách giọng nói',
      error: err.message
    };
  }
};

exports.uploadUserVoice = async (req, res) => {
  try {
    const userId = req.user._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực người dùng'
      });
    }

    const { index, job_id } = req.body;
    const file = req.file;

    if (!index || !job_id || !file) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu index, job_id hoặc file giọng nói' 
      });
    }

    const result = await voiceService.uploadVoice(index, file, job_id);
    res.status(200).json(result);
  } catch (err) {
    console.error('Lỗi khi upload giọng nói người dùng:', err);
    res.status(500).json({ 
      success: false,
      message: 'Có lỗi xảy ra',
      error: err.message 
    });
  }
};

exports.deleteVoice = async (req, res) => {
  try {
    const { voiceId } = req.params;

    if (!voiceId) {
      return res.status(400).json({ error: 'Thiếu voiceId' });
    }

    const result = await voiceService.deleteVoice({
      VoiceModel: VoiceModel,
      voiceId
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('Lỗi khi xoá giọng nói:', err);
    res.status(500).json({ error: 'Không thể xoá giọng nói' });
  }
};
