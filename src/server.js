import express from 'express';
import cors from 'cors';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// MỚI: Phục vụ file giao diện React đã build tĩnh
app.use(express.static(path.join(__dirname, 'dist')));

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');

app.post('/api/render', upload.fields([{ name: 'fgVideo', maxCount: 1 }, { name: 'bgVideo', maxCount: 1 }]), (req, res) => {
  try {
    const { blurAmount, ratio } = req.body;
    const fgFile = req.files['fgVideo']?.[0];
    const bgFile = req.files['bgVideo']?.[0];

    if (!fgFile || !bgFile) return res.status(400).json({ error: 'Thiếu file video' });

    const outputPath = path.join(__dirname, 'outputs', `rendered_${Date.now()}.mp4`);

    // Câu lệnh FFmpeg làm mờ nền và căn giữa
    const filterComplex = `[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=${blurAmount}:5[bg];[0:v]scale=1080:-1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;

    ffmpeg()
      .input(fgFile.path)
      .input(bgFile.path)
      .complexFilter(filterComplex)
      .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', '-c:a aac', '-shortest'])
      .save(outputPath)
      .on('end', () => {
        res.download(outputPath, 'rendered_video.mp4', () => {
          fs.unlinkSync(fgFile.path); fs.unlinkSync(bgFile.path); fs.unlinkSync(outputPath);
        });
      })
      .on('error', (err) => res.status(500).json({ error: 'Lỗi FFmpeg' }));

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// MỚI: Nếu người dùng truy cập bất kỳ link nào, trả về giao diện React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3001, () => console.log('🚀 Server đang chạy tại cổng 3001'));