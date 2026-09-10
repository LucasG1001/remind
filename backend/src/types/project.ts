export interface Project {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface ProjectTag {
  id: string;
  projectId: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTagRow {
  id: string;
  project_id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTagPatch {
  name?: string;
  color?: string;
  icon?: string;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  done: boolean;
  description: string;
  images: string[];
  checklist: ChecklistItem[];
  tagIds: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardRow {
  id: string;
  list_id: string;
  title: string;
  done: boolean;
  description: string;
  images: string[];
  checklist: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface BoardList {
  id: string;
  projectId: string;
  name: string;
  position: number;
  cards: Card[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardListRow {
  id: string;
  project_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectBoard extends Project {
  lists: BoardList[];
  tags: ProjectTag[];
}

export interface ProjectPatch {
  name?: string;
}

export interface ListPatch {
  name?: string;
}

export interface CardPatch {
  title?: string;
  done?: boolean;
  description?: string;
  images?: string[];
  checklist?: ChecklistItem[];
  tagIds?: string[];
}
