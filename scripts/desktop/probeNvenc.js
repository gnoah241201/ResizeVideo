/**
 * Desktop NVENC probe script
 * Probes the system for NVENC availability and configuration
 * 
 * Contract:
 * - Exits 0 when NVENC is available
 * - Exits 1 when NVENC is not available or not usable
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

function checkFfmpegAvailable() {
  try {
    const ffmpegPath = getFfmpegPath();
    execSync(`"${ffmpegPath}" -version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getFfmpegPath() {
  if (process.env.FFMPEG_BINARY_PATH) {
    return process.env.FFMPEG_BINARY_PATH;
  }
  
  const bundledPath = path.join(projectRoot, 'node_modules', '@ffmpeg-installer', 'ffmpeg', 'bin', 'ffmpeg.exe');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }
  
  return 'ffmpeg';
}

function checkNvencInEncoderList(ffmpegPath) {
  try {
    const output = execSync(`"${ffmpegPath}" -hide_banner -encoders 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    const hasNvenc = output.includes('h264_nvenc') || output.includes('hevc_nvenc');
    
    return {
      available: hasNvenc,
      details: hasNvenc ? 'NVENC encoders found in FFmpeg' : 'No NVENC encoders in FFmpeg',
    };
  } catch (error) {
    return {
      available: false,
      details: 'Failed to check encoder list: ' + error.message,
    };
  }
}

function checkNvencRuntime(ffmpegPath) {
  try {
    execSync(
      `"${ffmpegPath}" -hide_banner -vsync 0 -f lavfi -i color=c=blue:s=320x240:r=1 -c:v h264_nvenc -preset fast -t 1 -f null - 2>&1`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    
    return {
      usable: true,
      details: 'NVENC runtime probe successful - GPU encoding is available',
    };
  } catch (error) {
    return {
      usable: false,
      details: 'NVENC runtime probe failed: ' + error.message,
    };
  }
}

function checkNvidiaDriver() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('wmic path win32_VideoController get name', { encoding: 'utf-8', timeout: 5000 });
      return output.includes('NVIDIA') || output.includes('nvidia');
    }
    if (process.platform === 'darwin') {
      const output = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8', timeout: 5000 });
      return output.includes('NVIDIA') || output.includes('nvidia');
    }
    if (process.platform === 'linux') {
      const output = execSync('lspci | grep -i nvidia', { encoding: 'utf-8', timeout: 5000 });
      return output.includes('NVIDIA') || output.includes('nvidia');
    }
    return false;
  } catch {
    return false;
  }
}

function main() {
  console.log('[probe-nvenc] Probing NVENC availability...\n');
  
  var result = {
    ffmpegAvailable: false,
    nvencInEncoderList: false,
    nvencRuntimeUsable: false,
    nvidiaDriverInstalled: false,
  };
  
  console.log('[probe-nvenc] Checking FFmpeg...');
  result.ffmpegAvailable = checkFfmpegAvailable();
  console.log('[probe-nvenc] FFmpeg available: ' + (result.ffmpegAvailable ? 'YES' : 'NO'));
  
  if (!result.ffmpegAvailable) {
    console.error('\n[probe-nvenc] FFmpeg not found. Please install FFmpeg.');
    process.exit(1);
  }
  
  var ffmpegPath = getFfmpegPath();
  console.log('[probe-nvenc] Using FFmpeg: ' + ffmpegPath + '\n');
  
  console.log('[probe-nvenc] Checking NVENC in encoder list...');
  var encoderCheck = checkNvencInEncoderList(ffmpegPath);
  result.nvencInEncoderList = encoderCheck.available;
  console.log('[probe-nvenc] ' + (encoderCheck.available ? 'YES' : 'NO') + ' ' + encoderCheck.details);
  
  console.log('\n[probe-nvenc] Checking NVENC runtime...');
  var runtimeCheck = checkNvencRuntime(ffmpegPath);
  result.nvencRuntimeUsable = runtimeCheck.usable;
  console.log('[probe-nvenc] ' + (runtimeCheck.usable ? 'YES' : 'NO') + ' ' + runtimeCheck.details);
  
  console.log('\n[probe-nvenc] Checking NVIDIA driver...');
  result.nvidiaDriverInstalled = checkNvidiaDriver();
  console.log('[probe-nvenc] ' + (result.nvidiaDriverInstalled ? 'YES' : 'NO') + ' NVIDIA driver: ' + (result.nvidiaDriverInstalled ? 'installed' : 'not detected'));
  
  console.log('\n=== NVENC Probe Summary ===');
  console.log('FFmpeg available:     ' + (result.ffmpegAvailable ? 'YES' : 'NO'));
  console.log('NVENC in encoder list: ' + (result.nvencInEncoderList ? 'YES' : 'NO'));
  console.log('NVENC runtime usable:  ' + (result.nvencRuntimeUsable ? 'YES' : 'NO'));
  console.log('NVIDIA driver:        ' + (result.nvidiaDriverInstalled ? 'YES' : 'NO'));
  
  if (result.nvencRuntimeUsable) {
    console.log('\n[probe-nvenc] NVENC is available and ready to use');
    process.exit(0);
  } else {
    console.log('\n[probe-nvenc] NVENC is not available');
    console.log('\nTo fix:');
    console.log('1. Install NVIDIA GPU driver');
    console.log('2. Use FFmpeg compiled with NVENC support');
    console.log('3. Set FFMPEG_BINARY_PATH to your NVENC FFmpeg');
    process.exit(1);
  }
}

main();
