import api from './index';
import type { Requirement } from './requirements';

export interface DeployTask extends Requirement {
  artist_completed: number;
  deploy_completed: number;
  deploy_link: string | null;
  completion_files: string[];
  assignee_name?: string;
  creator_name?: string;
}

export async function getDeployLinks(params?: { status?: string; store_id?: number }) {
  const res = await api.get<{ items: DeployTask[]; counts?: { pending: number; deployed: number } }>('/deploy-links', { params });
  return res.data;
}

export async function completeDeploy(id: number, deployLink: string) {
  const res = await api.put<DeployTask>(`/deploy-links/${id}/complete`, { deploy_link: deployLink });
  return res.data;
}
