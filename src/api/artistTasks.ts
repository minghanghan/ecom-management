import api from './index';
import type { Requirement } from './requirements';

export interface ArtistTask extends Requirement {
  artist_completed: number;
  completion_files: string[];
  claimed_at: string | null;
  assignee_name?: string;
}

export async function getArtistTasks(params?: { status?: string; store_id?: number }) {
  const res = await api.get<{ items: ArtistTask[]; counts?: { pending: number; in_progress: number; completed: number } }>('/artist-tasks', { params });
  return res.data;
}

export async function claimTask(id: number) {
  const res = await api.post<ArtistTask>(`/artist-tasks/${id}/claim`);
  return res.data;
}

export async function completeTask(id: number, fileUrl?: string) {
  const res = await api.put<ArtistTask>(`/artist-tasks/${id}/complete`, { file_url: fileUrl });
  return res.data;
}

export async function saveTaskFiles(id: number, files: string[]) {
  const res = await api.post<{ files: string[] }>(`/artist-tasks/${id}/files`, { files });
  return res.data;
}

export async function updateTaskFilePath(id: number, fileUrl: string) {
  const res = await api.put<{ message: string }>(`/artist-tasks/${id}/file-path`, { file_url: fileUrl });
  return res.data;
}
