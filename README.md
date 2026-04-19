<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Video Render Stack

A native render service with a React frontend for processing video jobs.

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐
│   Frontend      │────────▶│   Backend (Express)   │
│   (Vite :3000)  │  /api   │   (Native :3001)     │
└─────────────────┘         └──────────────────────┘
                                          │
                                          ▼
                                   ┌──────────────────┐
                                   │   FFmpeg         │
                                   │   (video encode) │
                                   └──────────────────┘
```

- **Frontend**: React + Vite on port 3000, proxies API calls to backend
- **Backend**: Express server on port 3001, runs FFmpeg for video processing
- **API**: REST API at `/api/jobs`, health check at `/api/health`

## Prerequisites

- Node.js 18+

FFmpeg and ffprobe are bundled automatically via `@ffmpeg-installer` and `@ffprobe-installer` packages (installed with `npm install`). No manual installation required for normal usage.

## Run Locally

### Option 1: Start both frontend and backend

```bash
# Terminal 1: Start backend
npm run server

# Terminal 2: Start frontend
npm run dev
```

### Option 2: Start only frontend (for development)

The frontend proxies `/api` requests to the backend at `http://localhost:3001`.

```bash
npm run dev
```

## Run with Docker

This repository now includes a Docker-based deployment setup for local production-style usage.

### What gets started

- `frontend`: Nginx serving the built Vite app on port `8080` by default
- `backend`: Express + FFmpeg render server on internal port `3001`
- `render_data` volume: persisted render temp/output files at `/app/temp_superpowers/native-renders`

### Start the stack

```bash
docker compose up --build
```

Open the app at:

```text
http://localhost:8080
```

### Stop the stack

```bash
docker compose down
```

### Reset persisted render data

```bash
docker compose down -v
```

### Docker environment knobs

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `8080` | Host port exposed by the Nginx frontend container |
| `MAX_CONCURRENT_JOBS` | `5` | Backend render concurrency inside Docker (matches the app default) |
| `FFMPEG_ENCODER` | `libx264` | Encoder passed to the backend container |

### Notes

- The Docker backend image installs system `ffmpeg` and uses `FFMPEG_BINARY_PATH=/usr/bin/ffmpeg`.
- The frontend production build uses relative `/api` calls, so Nginx proxies API traffic to the backend container.
- This initial Docker setup is aimed at single-instance self-hosting. The current queue and file retention model are still local-volume based, not distributed.
- Docker build context now ignores local `.env` files by default; keep secrets out of the frontend image path.
- This first Docker setup is CPU-oriented. If you later want `h264_nvenc`, you will need to add GPU runtime/device configuration on top of the current compose file.

## Environment Variables

### Backend (server)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Backend server port |
| `MAX_CONCURRENT_JOBS` | 2 | Maximum concurrent video render jobs |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | - | Optional. Required only if using AI features. |
| `VITE_BACKEND_URL` | `http://localhost:3001` | Backend API URL for dev proxy |

### Example: Custom backend port

If you need to use a different backend port (e.g., 3002), you must set both the backend port and tell the frontend where to find it:

```bash
# Terminal 1: Start backend with custom port
PORT=3002 npm run server

# Terminal 2: Start frontend, pointing to custom backend port
VITE_BACKEND_URL=http://localhost:3002 npm run dev
```

The frontend uses `VITE_BACKEND_URL` to proxy `/api` requests to your custom backend URL.

## Health Check

The backend provides a health endpoint:

```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "ok": true,
  "port": 3001,
  "maxConcurrentJobs": 5,
  "encoder": "libx264"
}
```

The `encoder` field shows which encoder is currently in use (`libx264` or `h264_nvenc`).

## Concurrency Guidance

The `MAX_CONCURRENT_JOBS` setting controls how many videos can render simultaneously.

| Machine | Recommended Value | Notes |
|---------|------------------|-------|
| Low-end / limited RAM | 1-2 | Prevents memory pressure |
| Development / normal laptop | 5 | Default, balanced |
| Powerful workstation | 6+ | For faster batch processing |

**Note**: Each render job uses significant CPU and memory. Increasing concurrency beyond your machine's capacity will cause jobs to fail or the system to become unresponsive. You can override the default by setting `MAX_CONCURRENT_JOBS` environment variable.

## Encoder Mode (CPU vs NVIDIA NVENC)

By default, the backend uses CPU encoding (`libx264`). You can optionally enable NVIDIA NVENC for faster GPU-accelerated encoding.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FFMPEG_ENCODER` | `libx264` | Encoder to use: `libx264` (CPU) or `h264_nvenc` (NVIDIA GPU) |

### Enabling NVENC

```bash
# Use NVIDIA NVENC encoder (requires NVIDIA GPU + FFmpeg with NVENC support)
FFMPEG_ENCODER=h264_nvenc npm run server

# Explicitly use CPU encoder (default)
FFMPEG_ENCODER=libx264 npm run server
```

### NVENC Requirements

**Important**: The bundled FFmpeg binary from `@ffmpeg-installer` does **not** include usable NVENC support. NVENC mode only works when you explicitly point the app at an external FFmpeg binary that was compiled with NVENC.

1. **Runtime binary matters**: This app uses the bundled FFmpeg from `@ffmpeg-installer` by default. Simply installing system FFmpeg with NVENC support on your machine is NOT sufficient - you must configure the app to use a binary that actually supports NVENC.

2. To use NVENC, you need ALL of:
   - A separate FFmpeg binary with NVENC support (not the bundled one)
   - NVIDIA GPU with Kepler architecture or newer
   - NVIDIA driver installed
   - Set `FFMPEG_BINARY_PATH` to point to your NVENC-capable FFmpeg

**Configuration**:
| Variable | Default | Description |
|----------|---------|-------------|
| `FFMPEG_BINARY_PATH` | (bundled) | Path to FFmpeg binary to use |
| `FFMPEG_ENCODER` | `libx264` | Encoder: `libx264` (CPU) or `h264_nvenc` (GPU) |

**Example - Using system FFmpeg with NVENC**:
```bash
# On macOS with homebrew ffmpeg (which includes NVENC)
FFMPEG_BINARY_PATH=/opt/homebrew/bin/ffmpeg FFMPEG_ENCODER=h264_nvenc npm run server

# On Linux with system ffmpeg
FFMPEG_BINARY_PATH=/usr/bin/ffmpeg FFMPEG_ENCODER=h264_nvenc npm run server
```

If you request NVENC but the binary doesn't support it (or no GPU is available), the server will fail to start with a clear error message at startup.

### Behavior When NVENC Is Unavailable

- If `FFMPEG_ENCODER=h264_nvenc` is set but NVENC is not available: **fail fast** with clear error message
- The server will not silently fall back to CPU encoding - you must explicitly set `FFMPEG_ENCODER=libx264` to use CPU

### Benchmarking Guidance

To compare CPU vs NVENC performance:

1. Run the same workload with CPU encoder:
   ```bash
   FFMPEG_ENCODER=libx264 npm run server
   # Submit several render jobs and measure total time
   ```

2. Run the same workload with NVENC (on supported hardware):
   ```bash
   FFMPEG_ENCODER=h264_nvenc npm run server
   # Submit same jobs and measure total time
   ```

3. Compare:
   - **Wall-clock time**: Total time from first job submission to last job completion
   - **Output quality**: Check playback in various players
   - **CPU usage**: NVENC should use significantly less CPU

**Note**: NVENC may not always be faster than CPU for short videos or when the GPU is busy with other tasks. Always benchmark with your actual workload.

## Common Issues

### FFmpeg not found

If you see errors about FFmpeg not being available at startup:
1. Make sure you've run `npm install` to download the FFmpeg binaries
2. Try reinstalling: `npm install @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe`
3. If issues persist, you can install FFmpeg manually as a fallback:
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu/Debian**: `sudo apt install ffmpeg`
   - **Windows**: Download from https://ffmpeg.org/download.html

### Backend fails to start with port error

If you see `ERROR: Invalid PORT value`, make sure PORT is a number:
```bash
# Correct
PORT=3002 npm run server

# Incorrect - will fail
PORT=abc npm run server
```

### Frontend can't reach backend

If the frontend shows network errors:
1. Make sure the backend is running
2. If using a custom backend port, ensure you set `VITE_BACKEND_URL` when starting the frontend

### Jobs fail immediately

Check the backend logs for error messages. Common causes:
- Insufficient disk space
- FFmpeg/ffprobe not available (try `npm install`)
- Invalid input files

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/jobs` | Create render job |
| GET | `/api/jobs/:id` | Get job status |
| DELETE | `/api/jobs/:id` | Cancel job |
| GET | `/api/jobs/:id/download` | Download rendered video |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run server` | Start backend server |
| `npm run build` | Build frontend for production |
| `npm run lint` | Type-check the code |
| `npm run clean` | Remove build artifacts |
