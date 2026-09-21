export interface OpsLogUser {
  name: string;
  role: string;
  avatar: string | null;
  isCrown: boolean;
}

export interface OpsLog {
  id: string;
  date: string;
  time: string;
  user: OpsLogUser;
  actionText: string;
  actionIcon: string;
  department: string;
  status: 'completed' | 'failed' | 'pending';
  statusLabel: string;
}
