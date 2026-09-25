import { pool } from "../database/connection.js";
import { updateById, withTransaction } from "../database/transaction.js";
import { buildUpdateSet, nextPositionSql } from "../lib/sqlUpdate.js";
import { DomainError, ReorderMismatchError } from "./errors.js";
import type {
  BoardList,
  BoardListRow,
  Card,
  CardPatch,
  CardRow,
  ChecklistItem,
  ListPatch,
  Project,
  ProjectBoard,
  ProjectPatch,
  ProjectRow,
  ProjectTag,
  ProjectTagPatch,
  ProjectTagRow,
} from "../types/project.js";

function parseChecklist(raw: unknown): ChecklistItem[] {
  if (Array.isArray(raw)) return raw as ChecklistItem[];
  if (typeof raw !== "string") return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as ChecklistItem[]) : [];
  } catch {
    return [];
  }
}

function toTag(row: ProjectTagRow): ProjectTag {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Vínculos das tags dos cartões alcançados pelo filtro, na ordem das tags.
async function loadCardTagIds(where: string, params: unknown[]): Promise<Map<string, string[]>> {
  const result = await pool.query<{ card_id: string; tag_id: string }>(
    `SELECT ct.card_id, ct.tag_id
       FROM card_tags ct
       JOIN cards c ON c.id = ct.card_id
       JOIN board_lists l ON l.id = c.list_id
       JOIN project_tags t ON t.id = ct.tag_id
      WHERE ${where}
      ORDER BY t.position ASC, t.created_at ASC`,
    params
  );
  const byCard = new Map<string, string[]>();
  for (const row of result.rows) {
    const current = byCard.get(row.card_id);
    if (current) current.push(row.tag_id);
    else byCard.set(row.card_id, [row.tag_id]);
  }
  return byCard;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCard(row: CardRow, tagIds: string[]): Card {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    done: row.done,
    description: row.description ?? "",
    images: row.images ?? [],
    checklist: parseChecklist(row.checklist),
    tagIds,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBoardList(
  row: BoardListRow,
  cardRows: CardRow[],
  tagIdsByCard: Map<string, string[]>
): BoardList {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    position: row.position,
    cards: cardRows
      .filter((c) => c.list_id === row.id)
      .map((c) => toCard(c, tagIdsByCard.get(c.id) ?? [])),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAllProjects(): Promise<Project[]> {
  const result = await pool.query<ProjectRow>(
    "SELECT * FROM projects ORDER BY position ASC, created_at ASC"
  );
  return result.rows.map(toProject);
}

export async function findBoard(projectId: string): Promise<ProjectBoard | null> {
  const project = await pool.query<ProjectRow>("SELECT * FROM projects WHERE id = $1", [projectId]);
  if (!project.rows[0]) return null;

  const lists = await pool.query<BoardListRow>(
    "SELECT * FROM board_lists WHERE project_id = $1 ORDER BY position ASC, created_at ASC",
    [projectId]
  );
  const cards = await pool.query<CardRow>(
    `SELECT c.* FROM cards c
     JOIN board_lists l ON l.id = c.list_id
     WHERE l.project_id = $1
     ORDER BY c.position ASC, c.created_at ASC`,
    [projectId]
  );

  const tags = await pool.query<ProjectTagRow>(
    "SELECT * FROM project_tags WHERE project_id = $1 ORDER BY position ASC, created_at ASC",
    [projectId]
  );
  const tagIdsByCard = await loadCardTagIds("l.project_id = $1", [projectId]);

  return {
    ...toProject(project.rows[0]),
    lists: lists.rows.map((row) => toBoardList(row, cards.rows, tagIdsByCard)),
    tags: tags.rows.map(toTag),
  };
}

export async function createProject(name: string): Promise<Project> {
  const result = await pool.query<ProjectRow>(
    `INSERT INTO projects (name, position)
     VALUES ($1, ${nextPositionSql("projects")})
     RETURNING *`,
    [name]
  );
  return toProject(result.rows[0]!);
}

export async function updateProject(id: string, patch: ProjectPatch): Promise<Project | null> {
  const { sets, values, nextIndex } = buildUpdateSet(patch, { name: "name" });
  const row = await updateById<ProjectRow>("projects", id, sets, values, nextIndex);
  return row ? toProject(row) : null;
}

export async function removeProject(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM projects WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function createList(projectId: string, name: string): Promise<BoardList | null> {
  const project = await pool.query("SELECT id FROM projects WHERE id = $1", [projectId]);
  if (!project.rows[0]) return null;

  const result = await pool.query<BoardListRow>(
    `INSERT INTO board_lists (project_id, name, position)
     VALUES ($1, $2, ${nextPositionSql("board_lists", "project_id = $1")})
     RETURNING *`,
    [projectId, name]
  );
  return toBoardList(result.rows[0]!, [], new Map());
}

export async function updateList(id: string, patch: ListPatch): Promise<BoardList | null> {
  const { sets, values, nextIndex } = buildUpdateSet(patch, { name: "name" });
  const row = await updateById<BoardListRow>("board_lists", id, sets, values, nextIndex);
  if (!row) return null;
  const cards = await pool.query<CardRow>(
    "SELECT * FROM cards WHERE list_id = $1 ORDER BY position ASC, created_at ASC",
    [id]
  );
  const tagIdsByCard = await loadCardTagIds("c.list_id = $1", [id]);
  return toBoardList(row, cards.rows, tagIdsByCard);
}

export async function removeList(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM board_lists WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function reorderLists(projectId: string, orderedIds: string[]): Promise<ProjectBoard | null> {
  await withTransaction(async (client) => {
    // Mesma razão do reorder de hábitos: ordem parcial colide as posições.
    const total = await client.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM board_lists WHERE project_id = $1",
      [projectId]
    );
    if (Number(total.rows[0]!.n) !== orderedIds.length) {
      throw new ReorderMismatchError("todas as listas do quadro");
    }
    for (let i = 0; i < orderedIds.length; i++) {
      const result = await client.query(
        "UPDATE board_lists SET position = $1, updated_at = NOW() WHERE id = $2 AND project_id = $3",
        [i, orderedIds[i], projectId]
      );
      if ((result.rowCount ?? 0) === 0) throw new ReorderMismatchError("todas as listas do quadro");
    }
  });
  return findBoard(projectId);
}

export async function createCard(listId: string, title: string, tagIds: string[] = []): Promise<Card | null> {
  const list = await pool.query("SELECT id FROM board_lists WHERE id = $1", [listId]);
  if (!list.rows[0]) return null;

  const result = await pool.query<CardRow>(
    `INSERT INTO cards (list_id, title, position)
     VALUES ($1, $2, ${nextPositionSql("cards", "list_id = $1")})
     RETURNING *`,
    [listId, title]
  );
  const row = result.rows[0]!;
  if (tagIds.length === 0) return toCard(row, []);
  try {
    await syncCardTags(row.id, tagIds);
  } catch (err) {
    // O cliente recebe erro e não põe o cartão no quadro: mantido, ele reapareceria só no reload.
    await pool.query("DELETE FROM cards WHERE id = $1", [row.id]);
    throw err;
  }
  const tagIdsByCard = await loadCardTagIds("c.id = $1", [row.id]);
  return toCard(row, tagIdsByCard.get(row.id) ?? []);
}

// Substitui o conjunto de tags do cartão. Retorna false quando o cartão não existe
// (o controller responde 404) e recusa tags de outro projeto com 400 em vez de deixar
// a violação de FK vazar como 500.
async function syncCardTags(cardId: string, tagIds: string[]): Promise<boolean> {
  const unique = [...new Set(tagIds)];
  return withTransaction(async (client) => {
    const scope = await client.query<{ project_id: string }>(
      "SELECT l.project_id FROM cards c JOIN board_lists l ON l.id = c.list_id WHERE c.id = $1",
      [cardId]
    );
    const projectId = scope.rows[0]?.project_id;
    if (!projectId) return false;

    if (unique.length > 0) {
      const valid = await client.query(
        "SELECT id FROM project_tags WHERE project_id = $1 AND id = ANY($2::uuid[])",
        [projectId, unique]
      );
      if ((valid.rowCount ?? 0) !== unique.length) {
        throw new DomainError("Tag inválida para este projeto.", 400);
      }
    }

    await client.query("DELETE FROM card_tags WHERE card_id = $1 AND NOT (tag_id = ANY($2::uuid[]))", [
      cardId,
      unique,
    ]);
    if (unique.length > 0) {
      await client.query(
        `INSERT INTO card_tags (card_id, tag_id)
         SELECT $1, t FROM UNNEST($2::uuid[]) AS t
         ON CONFLICT DO NOTHING`,
        [cardId, unique]
      );
    }
    return true;
  });
}

export async function updateCard(id: string, patch: CardPatch): Promise<Card | null> {
  const { checklist, tagIds, ...rest } = patch;
  if (tagIds !== undefined && !(await syncCardTags(id, tagIds))) return null;
  const { sets, values, nextIndex } = buildUpdateSet(rest, {
    title: "title",
    done: "done",
    description: "description",
    images: "images",
  });
  let idIndex = nextIndex;
  if (checklist !== undefined) {
    sets.push(`checklist = $${idIndex++}`);
    values.push(JSON.stringify(checklist));
  }
  const row = await updateById<CardRow>("cards", id, sets, values, idIndex);
  if (!row) return null;
  const tagIdsByCard = await loadCardTagIds("c.id = $1", [id]);
  return toCard(row, tagIdsByCard.get(id) ?? []);
}

export async function removeCard(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM cards WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function moveCard(cardId: string, toListId: string, position: number): Promise<ProjectBoard | null> {
  const projectId = await withTransaction(async (client) => {
    const cardResult = await client.query<CardRow>("SELECT * FROM cards WHERE id = $1", [cardId]);
    const card = cardResult.rows[0];
    if (!card) throw new DomainError("Cartão não encontrado.", 404);

    const listsResult = await client.query<BoardListRow>(
      "SELECT * FROM board_lists WHERE id = ANY($1::uuid[])",
      [[card.list_id, toListId]]
    );
    const source = listsResult.rows.find((l) => l.id === card.list_id)!;
    const target = listsResult.rows.find((l) => l.id === toListId);
    if (!target) throw new DomainError("Lista de destino não encontrada.", 404);
    if (target.project_id !== source.project_id) {
      throw new DomainError("A lista de destino pertence a outro projeto.", 400);
    }

    const targetResult = await client.query<{ id: string }>(
      "SELECT id FROM cards WHERE list_id = $1 AND id <> $2 ORDER BY position ASC, created_at ASC",
      [toListId, cardId]
    );
    const targetIds = targetResult.rows.map((r) => r.id);
    const index = Math.max(0, Math.min(position, targetIds.length));
    targetIds.splice(index, 0, cardId);

    await client.query("UPDATE cards SET list_id = $1, updated_at = NOW() WHERE id = $2", [toListId, cardId]);
    for (let i = 0; i < targetIds.length; i++) {
      await client.query("UPDATE cards SET position = $1 WHERE id = $2", [i, targetIds[i]]);
    }

    if (card.list_id !== toListId) {
      const sourceResult = await client.query<{ id: string }>(
        "SELECT id FROM cards WHERE list_id = $1 AND id <> $2 ORDER BY position ASC, created_at ASC",
        [card.list_id, cardId]
      );
      for (let i = 0; i < sourceResult.rows.length; i++) {
        await client.query("UPDATE cards SET position = $1 WHERE id = $2", [i, sourceResult.rows[i]!.id]);
      }
    }

    return source.project_id;
  });
  return findBoard(projectId);
}

export async function createTag(
  projectId: string,
  name: string,
  color: string,
  icon: string
): Promise<ProjectTag | null> {
  const project = await pool.query("SELECT id FROM projects WHERE id = $1", [projectId]);
  if (!project.rows[0]) return null;

  const result = await pool.query<ProjectTagRow>(
    `INSERT INTO project_tags (project_id, name, color, icon, position)
     VALUES ($1, $2, $3, $4, ${nextPositionSql("project_tags", "project_id = $1")})
     RETURNING *`,
    [projectId, name, color, icon]
  );
  return toTag(result.rows[0]!);
}

export async function updateTag(id: string, patch: ProjectTagPatch): Promise<ProjectTag | null> {
  const { sets, values, nextIndex } = buildUpdateSet(patch, {
    name: "name",
    color: "color",
    icon: "icon",
  });
  const row = await updateById<ProjectTagRow>("project_tags", id, sets, values, nextIndex);
  return row ? toTag(row) : null;
}

export async function removeTag(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM project_tags WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
