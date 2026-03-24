import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Volume2, VolumeX, Image as ImageIcon, Film, Type, Move, Download, X } from 'lucide-react';

type OutputConfig = {
  id: string;
  ratio: '9:16' | '16:9' | '4:5' | '1:1';
  duration?: 6 | 15;
  label: string;
};

const getOutputs = (inputRatio: '16:9' | '9:16'): OutputConfig[] => {
  if (inputRatio === '16:9') {
    return [
      { id: '9:16', ratio: '9:16', label: 'Output: 9:16' },
      { id: '16:9-6s', ratio: '16:9', duration: 6, label: 'Output: 16:9 (6s cut)' },
      { id: '16:9-15s', ratio: '16:9', duration: 15, label: 'Output: 16:9 (15s cut)' },
      { id: '4:5', ratio: '4:5', label: 'Output: 4:5' },
      { id: '1:1', ratio: '1:1', label: 'Output: 1:1' },
    ];
  } else {
    return [
      { id: '9:16-6s', ratio: '9:16', duration: 6, label: 'Output: 9:16 (6s cut)' },
      { id: '9:16-15s', ratio: '9:16', duration: 15, label: 'Output: 9:16 (15s cut)' },
      { id: '16:9', ratio: '16:9', label: 'Output: 16:9' },
      { id: '4:5', ratio: '4:5', label: 'Output: 4:5' },
      { id: '1:1', ratio: '1:1', label: 'Output: 1:1' },
    ];
  }
};

function PreviewBox({
  inputRatio,
  outputRatio,
  duration,
  label,
  fgVideo,
  bgVideo,
  blurAmount,
  logo, logoX, logoY, logoSize,
  buttonType, buttonText, buttonImage, buttonX, buttonY, buttonSize,
  isMuted
}: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const fgVideoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (isPlaying) {
      bgVideoRef.current?.pause();
      fgVideoRef.current?.pause();
      setIsPlaying(false);
    } else {
      bgVideoRef.current?.play().catch(() => {});
      fgVideoRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    const fg = fgVideoRef.current;
    const bg = bgVideoRef.current;
    if (!fg || !bg) return;

    const syncVideos = () => {
      if (Math.abs(fg.currentTime - bg.currentTime) > 0.3) {
        bg.currentTime = fg.currentTime;
      }
    };

    const handleTimeUpdate = () => {
      if (duration && fg.currentTime >= duration) {
        fg.currentTime = 0;
        bg.currentTime = 0;
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      fg.currentTime = 0;
      bg.currentTime = 0;
    };

    fg.addEventListener('seeked', syncVideos);
    fg.addEventListener('play', handlePlay);
    fg.addEventListener('pause', handlePause);
    fg.addEventListener('timeupdate', handleTimeUpdate);
    fg.addEventListener('ended', handleEnded);

    return () => {
      fg.removeEventListener('seeked', syncVideos);
      fg.removeEventListener('play', handlePlay);
      fg.removeEventListener('pause', handlePause);
      fg.removeEventListener('timeupdate', handleTimeUpdate);
      fg.removeEventListener('ended', handleEnded);
    };
  }, [fgVideo, bgVideo, duration]);

  useEffect(() => {
    setIsPlaying(false);
  }, [fgVideo, bgVideo]);

  const showOverlays = (inputRatio === '16:9' && ['9:16', '4:5', '1:1'].includes(outputRatio)) || 
                       (inputRatio === '9:16' && outputRatio === '16:9');

  return (
    <div className="flex flex-col items-center w-full mb-12 pb-8 border-b border-neutral-800/50 last:border-0">
      <div className="flex items-center justify-between w-full max-w-[640px] mb-4 px-4">
        <h3 className="text-lg font-semibold text-white">{label}</h3>
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          disabled={!fgVideo}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-1" />}
        </button>
      </div>
      
      <div 
        className={`relative w-full bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 group transition-all duration-500 ease-in-out ${
          outputRatio === '9:16' ? 'aspect-[9/16] max-w-[360px]' : 
          outputRatio === '16:9' ? 'aspect-video max-w-[640px]' : 
          outputRatio === '4:5' ? 'aspect-[4/5] max-w-[400px]' : 
          'aspect-square max-w-[450px]'
        }`}
      >
        {/* Background Video */}
        {bgVideo ? (
          <video
            ref={bgVideoRef}
            src={bgVideo}
            className="absolute inset-0 w-full h-full object-cover scale-110 opacity-70 transition-all duration-300"
            style={{ filter: `blur(${blurAmount}px)` }}
            muted
            loop
            playsInline
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-700 bg-neutral-900/30">
            <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
            <span className="text-xs font-medium uppercase tracking-widest opacity-50">Background</span>
          </div>
        )}

        {/* Foreground Video */}
        {fgVideo ? (
          <video
            ref={fgVideoRef}
            src={fgVideo}
            className={`absolute z-10 drop-shadow-2xl cursor-pointer object-contain transition-all duration-500 ${
              inputRatio === '9:16' && outputRatio === '16:9'
                ? 'right-[40px] top-0 bottom-0 w-auto h-full aspect-[9/16]'
                : 'inset-0 w-full h-full'
            }`}
            muted={isMuted}
            loop
            playsInline
            onClick={togglePlay}
          />
        ) : (
          <div className={`absolute flex flex-col items-center justify-center text-neutral-500 z-10 bg-neutral-950/80 backdrop-blur-sm transition-all duration-500 ${
            inputRatio === '9:16' && outputRatio === '16:9'
              ? 'right-[40px] top-0 bottom-0 w-auto h-full aspect-[9/16] border-x border-neutral-800/50'
              : inputRatio === '16:9'
                ? 'inset-x-0 border-y border-neutral-800/50 my-auto w-full aspect-video h-fit'
                : 'inset-y-0 border-x border-neutral-800/50 mx-auto h-full aspect-[9/16] w-fit'
          }`}>
            <Film className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs font-medium uppercase tracking-widest opacity-80">Foreground</span>
          </div>
        )}

        {/* Overlays Container */}
        {showOverlays && (
          <div className="absolute inset-0 z-30 flex flex-col pointer-events-none">
            {inputRatio === '16:9' ? (
              <>
                {/* Top Empty Space (Logo) */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4">
                  {logo && (
                    <img 
                      src={logo} 
                      alt="Logo" 
                      className="max-w-full max-h-full object-contain drop-shadow-lg"
                      style={{ 
                        transform: `translate(${logoX}px, ${logoY}px) scale(${logoSize / 100})` 
                      }} 
                    />
                  )}
                </div>

                {/* Middle Space (Foreground Video Area - exactly 16:9) */}
                <div className="w-full aspect-video shrink-0"></div>

                {/* Bottom Empty Space (Button) */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4">
                  {((buttonType === 'text' && buttonText) || (buttonType === 'image' && buttonImage)) && (
                    <div 
                      className="flex justify-center items-center w-full"
                      style={{ 
                        transform: `translate(${buttonX}px, ${buttonY}px) scale(${buttonSize / 100})` 
                      }}
                    >
                      {buttonType === 'text' ? (
                        <div 
                          className="px-8 py-3 font-bold rounded-full whitespace-nowrap text-lg tracking-wide relative overflow-hidden"
                          style={{
                            color: '#FFFFFF',
                            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            textShadow: '0px 2px 4px rgba(0, 0, 0, 0.4)',
                            background: 'linear-gradient(to bottom, #FFD700 0%, #FFB800 50%, #FF8A00 100%)',
                            border: '1px solid #D2691E',
                            boxShadow: '0px 6px 8px 0px rgba(0, 0, 0, 0.5), inset 2px 2px 4px rgba(255, 255, 255, 0.6)',
                          }}
                        >
                          {buttonText}
                        </div>
                      ) : (
                        <img 
                          src={buttonImage!} 
                          alt="Custom Button" 
                          className="max-w-full max-h-full object-contain drop-shadow-xl"
                        />
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="absolute inset-0 z-30 flex pointer-events-none">
                {/* Left Space (Logo and Button) */}
                <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 relative">
                  <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                    {logo && (
                      <img 
                        src={logo} 
                        alt="Logo" 
                        className="max-w-full max-h-full object-contain drop-shadow-lg"
                        style={{ 
                          transform: `translate(${logoX}px, ${logoY}px) scale(${logoSize / 100})` 
                        }} 
                      />
                    )}
                  </div>
                  <div className="h-4 shrink-0"></div>
                  <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                    {((buttonType === 'text' && buttonText) || (buttonType === 'image' && buttonImage)) && (
                      <div 
                        className="flex justify-center items-center w-full"
                        style={{ 
                          transform: `translate(${buttonX}px, ${buttonY}px) scale(${buttonSize / 100})` 
                        }}
                      >
                        {buttonType === 'text' ? (
                          <div 
                            className="px-6 py-2 font-bold rounded-full whitespace-nowrap text-sm md:text-base tracking-wide relative overflow-hidden"
                            style={{
                              color: '#FFFFFF',
                              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              textShadow: '0px 2px 4px rgba(0, 0, 0, 0.4)',
                              background: 'linear-gradient(to bottom, #FFD700 0%, #FFB800 50%, #FF8A00 100%)',
                              border: '1px solid #D2691E',
                              boxShadow: '0px 6px 8px 0px rgba(0, 0, 0, 0.5), inset 2px 2px 4px rgba(255, 255, 255, 0.6)',
                            }}
                          >
                            {buttonText}
                          </div>
                        ) : (
                          <img 
                            src={buttonImage!} 
                            alt="Custom Button" 
                            className="max-w-full max-h-full object-contain drop-shadow-xl"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Space (Foreground Video Area) */}
                <div className="h-full aspect-[9/16] shrink-0 mr-[40px]"></div>
              </div>
            )}
          </div>
        )}

        {/* Playback Overlay */}
        {fgVideo && !isPlaying && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/20">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [bgVideo, setBgVideo] = useState<string | null>(null);
  const [fgVideo, setFgVideo] = useState<string | null>(null);
  const [fgVideoFile, setFgVideoFile] = useState<File | null>(null);
  const [bgVideoFile, setBgVideoFile] = useState<File | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [blurAmount, setBlurAmount] = useState(24); // px

  const [logo, setLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(100);
  const [buttonType, setButtonType] = useState<'text' | 'image'>('text');
  const [buttonText, setButtonText] = useState('Play Now');
  const [buttonImage, setButtonImage] = useState<string | null>(null);
  const [buttonSize, setButtonSize] = useState(100);
  const [buttonX, setButtonX] = useState(0);
  const [buttonY, setButtonY] = useState(0);
  const [logoX, setLogoX] = useState(0);
  const [logoY, setLogoY] = useState(0);
  const [inputRatio, setInputRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [selectedDownloads, setSelectedDownloads] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const outputs = getOutputs(inputRatio);

  const handleOpenDownloadModal = () => {
    setSelectedDownloads(outputs.map(o => o.id));
    setIsDownloadModalOpen(true);
    setIsDownloading(false);
    setDownloadProgress(0);
  };

  const handleDownload = async () => {
    if (!fgVideoFile || !bgVideoFile || selectedDownloads.length === 0) {
      alert("Vui lòng tải lên cả video Foreground và Background!");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(20); 
    
    // Lấy thông tin output được chọn (chọn 1 output để demo)
    const outputToRender = outputs.find(o => o.id === selectedDownloads[0]);

    // Đóng gói dữ liệu gửi đi
    const formData = new FormData();
    formData.append('fgVideo', fgVideoFile);
    formData.append('bgVideo', bgVideoFile);
    formData.append('blurAmount', blurAmount.toString());
    formData.append('ratio', outputToRender?.ratio || '9:16');

    try {
      setDownloadProgress(50); // Báo hiệu đang xử lý FFmpeg
      
      // MỚI: Gọi API bằng đường dẫn tương đối (vì FE và BE chạy chung port)
      const response = await fetch('/api/render', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Render failed on server');

      setDownloadProgress(90);

      // Nhận và tải file video kết quả về trình duyệt
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rendered_${outputToRender?.id || 'video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadProgress(100);
    } catch (error) {
      console.error("Lỗi:", error);
      alert("Đã xảy ra lỗi khi render video.");
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
        setIsDownloadModalOpen(false);
      }, 1000);
    }
  };

  const handleButtonImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setButtonImage(URL.createObjectURL(file));
      setButtonType('image');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(URL.createObjectURL(file));
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBgVideoFile(file); // MỚI: Lưu file để gửi lên server
      setBgVideo(URL.createObjectURL(file));
    }
  };

  const handleFgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFgVideoFile(file); // MỚI: Lưu file để gửi lên server
      setFgVideo(URL.createObjectURL(file));
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        
        {/* Controls Section */}
        <div className="lg:col-span-7 space-y-8 flex flex-col justify-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
              Vertical Layout <span className="text-blue-500">Editor</span>
            </h1>
            <p className="text-lg text-neutral-400 max-w-xl">
              Upload a 16:9 foreground and background video to create a seamless 9:16 vertical layout for TikTok, Reels, or Shorts.
            </p>
          </div>

          <div className="space-y-6">
            {/* Input Format Control */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 transition-all hover:border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                    <Film className="w-4 h-4" />
                  </div>
                  Input Format
                </h2>
              </div>
              <div className="flex bg-neutral-800 p-1 rounded-lg">
                {(['16:9', '9:16'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => {
                      setInputRatio(ratio);
                    }}
                    className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${inputRatio === ratio ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Foreground Upload */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 transition-all hover:border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                    <Film className="w-4 h-4" />
                  </div>
                  Foreground Video
                </h2>
                <span className="text-xs font-medium px-2.5 py-1 bg-neutral-800 text-neutral-300 rounded-full">{inputRatio}</span>
              </div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-700 border-dashed rounded-xl cursor-pointer hover:bg-neutral-800/80 hover:border-blue-500/50 transition-all group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-neutral-500 group-hover:text-blue-400 transition-colors" />
                  <p className="mb-2 text-sm text-neutral-400"><span className="font-semibold text-neutral-200">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-neutral-500">MP4, WebM, or OGG</p>
                </div>
                <input type="file" className="hidden" accept="video/*" onChange={handleFgUpload} />
              </label>
              {fgVideo && <p className="mt-3 text-sm text-green-400 flex items-center gap-2">✓ Foreground video loaded</p>}
            </div>

            {/* Background Upload */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 transition-all hover:border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  Background Video
                </h2>
                <span className="text-xs font-medium px-2.5 py-1 bg-neutral-800 text-neutral-300 rounded-full">{inputRatio}</span>
              </div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-700 border-dashed rounded-xl cursor-pointer hover:bg-neutral-800/80 hover:border-purple-500/50 transition-all group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-neutral-500 group-hover:text-purple-400 transition-colors" />
                  <p className="mb-2 text-sm text-neutral-400"><span className="font-semibold text-neutral-200">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-neutral-500">MP4, WebM, or OGG</p>
                </div>
                <input type="file" className="hidden" accept="video/*" onChange={handleBgUpload} />
              </label>
              {bgVideo && <p className="mt-3 text-sm text-green-400 flex items-center gap-2">✓ Background video loaded</p>}
            </div>

            {/* Blur Control */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-neutral-300">Background Blur Intensity</h2>
                <span className="text-xs font-mono text-neutral-500">{blurAmount}px</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="64" 
                value={blurAmount} 
                onChange={(e) => setBlurAmount(Number(e.target.value))}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Logo Control */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 transition-all hover:border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  Logo Overlay
                </h2>
              </div>
              
              {!logo ? (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-neutral-700 border-dashed rounded-xl cursor-pointer hover:bg-neutral-800/80 hover:border-emerald-500/50 transition-all group mb-4">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-6 h-6 mb-2 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
                    <p className="text-sm text-neutral-400">Upload Logo (Image)</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              ) : (
                <div className="flex items-center justify-between bg-neutral-800 rounded-xl p-3 mb-4 border border-neutral-700">
                  <span className="text-sm text-emerald-400 flex items-center gap-2">✓ Logo loaded</span>
                  <button onClick={() => setLogo(null)} className="text-xs text-neutral-400 hover:text-white px-2 py-1 bg-neutral-700 rounded-md">Remove</button>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>Size</span>
                    <span>{logoSize}%</span>
                  </div>
                  <input type="range" min="10" max="250" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>Position X</span>
                    <span>{logoX}px</span>
                  </div>
                  <input type="range" min="-500" max="500" value={logoX} onChange={(e) => setLogoX(Number(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>Position Y</span>
                    <span>{logoY}px</span>
                  </div>
                  <input type="range" min="-500" max="500" value={logoY} onChange={(e) => setLogoY(Number(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
              </div>
            </div>

            {/* Button Control */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 transition-all hover:border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                    <Type className="w-4 h-4" />
                  </div>
                  Call to Action Button
                </h2>
              </div>
              
              <div className="flex bg-neutral-800 p-1 rounded-lg mb-4">
                <button 
                  className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${buttonType === 'text' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                  onClick={() => setButtonType('text')}
                >Text Style</button>
                <button 
                  className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${buttonType === 'image' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                  onClick={() => setButtonType('image')}
                >Custom Image</button>
              </div>

              {buttonType === 'text' ? (
                <div className="mb-4">
                  <label className="block text-xs text-neutral-400 mb-1">Button Text</label>
                  <input 
                    type="text" 
                    value={buttonText} 
                    onChange={(e) => setButtonText(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="Enter button text..."
                  />
                </div>
              ) : (
                <div className="mb-4">
                  {!buttonImage ? (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-neutral-700 border-dashed rounded-xl cursor-pointer hover:bg-neutral-800/80 hover:border-amber-500/50 transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-6 h-6 mb-2 text-neutral-500 group-hover:text-amber-400 transition-colors" />
                        <p className="text-sm text-neutral-400">Upload Button Image</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleButtonImageUpload} />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between bg-neutral-800 rounded-xl p-3 border border-neutral-700">
                      <span className="text-sm text-amber-400 flex items-center gap-2">✓ Image loaded</span>
                      <button onClick={() => setButtonImage(null)} className="text-xs text-neutral-400 hover:text-white px-2 py-1 bg-neutral-700 rounded-md">Remove</button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>Size</span>
                    <span>{buttonSize}%</span>
                  </div>
                  <input type="range" min="10" max="250" value={buttonSize} onChange={(e) => setButtonSize(Number(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>Position X</span>
                    <span>{buttonX}px</span>
                  </div>
                  <input type="range" min="-500" max="500" value={buttonX} onChange={(e) => setButtonX(Number(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>Position Y</span>
                    <span>{buttonY}px</span>
                  </div>
                  <input type="range" min="-500" max="500" value={buttonY} onChange={(e) => setButtonY(Number(e.target.value))} className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Preview Section */}
        <div className="lg:col-span-5 flex flex-col items-center lg:sticky lg:top-8 h-[calc(100vh-4rem)] overflow-y-auto pb-8 pr-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
          <div className="w-full flex justify-between items-center mb-6 sticky top-0 z-50 bg-neutral-950/90 backdrop-blur-md py-4 border-b border-neutral-800">
            <h2 className="text-2xl font-bold text-white">Previews</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className="px-4 py-2 flex items-center gap-2 text-sm font-medium bg-neutral-800 text-white rounded-full hover:bg-neutral-700 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{isMuted ? 'Unmute All' : 'Mute All'}</span>
              </button>
              <button
                onClick={handleOpenDownloadModal}
                disabled={!fgVideo}
                className="px-4 py-2 flex items-center gap-2 text-sm font-medium bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>

          {outputs.map((output) => (
            <PreviewBox
              key={output.id}
              inputRatio={inputRatio}
              outputRatio={output.ratio}
              duration={output.duration}
              label={output.label}
              fgVideo={fgVideo}
              bgVideo={bgVideo}
              blurAmount={blurAmount}
              logo={logo}
              logoX={logoX}
              logoY={logoY}
              logoSize={logoSize}
              buttonType={buttonType}
              buttonText={buttonText}
              buttonImage={buttonImage}
              buttonX={buttonX}
              buttonY={buttonY}
              buttonSize={buttonSize}
              isMuted={isMuted}
            />
          ))}
        </div>
      </div>

      {/* Download Modal */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-500" />
                Download Outputs
              </h2>
              <button 
                onClick={() => !isDownloading && setIsDownloadModalOpen(false)} 
                disabled={isDownloading}
                className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-800 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {isDownloading ? (
              <div className="py-8 flex flex-col items-center justify-center">
                <div className="w-full bg-neutral-800 rounded-full h-3 mb-4 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-200" 
                    style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
                <p className="text-neutral-400 font-medium animate-pulse">Processing videos... {downloadProgress}%</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-8 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                  {outputs.map(output => (
                    <label key={output.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-800/50 border border-neutral-700/50 cursor-pointer hover:bg-neutral-800 transition-colors group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={selectedDownloads.includes(output.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDownloads(prev => [...prev, output.id]);
                            } else {
                              setSelectedDownloads(prev => prev.filter(id => id !== output.id));
                            }
                          }}
                          className="peer w-5 h-5 rounded border-neutral-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-900 bg-neutral-700 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-all"
                        />
                        <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">{output.label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDownloadModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDownload}
                    disabled={selectedDownloads.length === 0}
                    className="flex-1 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download ({selectedDownloads.length})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
