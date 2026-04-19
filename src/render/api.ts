import { CreateJobResponse, JobStateResponse, RenderSpec, ApiError } from '../../shared/render-contract';

const API_BASE = '/api/jobs';

async function parseErrorResponse(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const json = await response.json() as ApiError;
    if (json.error && json.message) {
      return json;
    }
  }
  // Fallback to text
  const text = await response.text();
  return {
    error: 'Error',
    message: text || `Request failed with status ${response.status}`,
  };
}

export const createRenderJob = async (params: {
  spec: RenderSpec;
  foregroundFile: File;
  backgroundVideoFile?: File | null;
  backgroundImageFile?: File | null;
  overlayPng?: Blob | null;
}): Promise<CreateJobResponse> => {
  const body = new FormData();
  body.append('spec', JSON.stringify(params.spec));
  body.append('foreground', params.foregroundFile);

  if (params.backgroundVideoFile) {
    body.append('backgroundVideo', params.backgroundVideoFile);
  }

  if (params.backgroundImageFile) {
    body.append('backgroundImage', params.backgroundImageFile);
  }

  if (params.overlayPng) {
    body.append('overlay', params.overlayPng, 'overlay.png');
  }

  const response = await fetch(API_BASE, {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    throw new Error(error.message);
  }

  return response.json();
};

export const getRenderJob = async (jobId: string): Promise<JobStateResponse> => {
  const response = await fetch(`${API_BASE}/${jobId}`);
  if (!response.ok) {
    const error = await parseErrorResponse(response);
    throw new Error(error.message);
  }
  return response.json();
};

export const cancelRenderJob = async (jobId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/${jobId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    throw new Error(error.message);
  }
};

export const downloadRenderJob = async (jobId: string): Promise<Blob> => {
  const response = await fetch(`${API_BASE}/${jobId}/download`);
  if (!response.ok) {
    const error = await parseErrorResponse(response);
    throw new Error(error.message);
  }
  return response.blob();
};

/**
 * Create a trim-only job that trims from a completed job's output (stream copy, no re-encode).
 */
export const createTrimJob = async (params: {
  spec: RenderSpec;
  sourceJobId: string;
}): Promise<CreateJobResponse> => {
  const response = await fetch(`${API_BASE}/trim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spec: params.spec,
      sourceJobId: params.sourceJobId,
    }),
  });

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    throw new Error(error.message);
  }

  return response.json();
};
