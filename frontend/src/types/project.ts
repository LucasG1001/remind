export interface Project {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
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

export interface ProjectTagFormData {
  name: string;
  color: string;
  icon: string;
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

export interface BoardList {
  id: string;
  projectId: string;
  name: string;
  position: number;
  cards: Card[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBoard extends Project {
  lists: BoardList[];
  tags: ProjectTag[];
}

export interface CardPatch {
  title?: string;
  done?: boolean;
  description?: string;
  images?: string[];
  checklist?: ChecklistItem[];
  tagIds?: string[];
}
