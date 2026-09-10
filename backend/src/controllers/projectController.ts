import {
  createCardSchema,
  createListSchema,
  createProjectSchema,
  createTagSchema,
  moveCardSchema,
  reorderListsSchema,
  updateCardSchema,
  updateListSchema,
  updateProjectSchema,
  updateTagSchema,
} from "../schemas/project.js";
import * as projectModel from "../models/projectModel.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseBody, requireUuid } from "../lib/validation.js";

const PROJECT_NOT_FOUND = "Projeto não encontrado.";
const LIST_NOT_FOUND = "Lista não encontrada.";
const CARD_NOT_FOUND = "Cartão não encontrado.";
const TAG_NOT_FOUND = "Tag não encontrada.";

export const getProjects = asyncHandler("Erro ao buscar projetos.", async (_req, res) => {
  const projects = await projectModel.findAllProjects();
  res.json(projects);
});

export const getBoard = asyncHandler("Erro ao buscar projeto.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, PROJECT_NOT_FOUND)) return;
  const board = await projectModel.findBoard(id);
  if (!board) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }
  res.json(board);
});

export const createProject = asyncHandler("Erro ao criar projeto.", async (req, res) => {
  const body = parseBody(res, createProjectSchema, req.body);
  if (!body) return;
  const project = await projectModel.createProject(body.name);
  res.status(201).json(project);
});

export const updateProject = asyncHandler("Erro ao atualizar projeto.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, PROJECT_NOT_FOUND)) return;
  const body = parseBody(res, updateProjectSchema, req.body);
  if (!body) return;
  const project = await projectModel.updateProject(id, body);
  if (!project) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }
  res.json(project);
});

export const removeProject = asyncHandler("Erro ao remover projeto.", async (req, res) => {
  const id = String(req.params.id);
  if (!requireUuid(res, id, PROJECT_NOT_FOUND)) return;
  const removed = await projectModel.removeProject(id);
  if (!removed) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }
  res.status(204).send();
});

export const createList = asyncHandler("Erro ao criar lista.", async (req, res) => {
  const projectId = String(req.params.id);
  if (!requireUuid(res, projectId, PROJECT_NOT_FOUND)) return;
  const body = parseBody(res, createListSchema, req.body);
  if (!body) return;
  const list = await projectModel.createList(projectId, body.name);
  if (!list) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }
  res.status(201).json(list);
});

export const updateList = asyncHandler("Erro ao atualizar lista.", async (req, res) => {
  const listId = String(req.params.listId);
  if (!requireUuid(res, listId, LIST_NOT_FOUND)) return;
  const body = parseBody(res, updateListSchema, req.body);
  if (!body) return;
  const list = await projectModel.updateList(listId, body);
  if (!list) {
    res.status(404).json({ error: LIST_NOT_FOUND });
    return;
  }
  res.json(list);
});

export const removeList = asyncHandler("Erro ao remover lista.", async (req, res) => {
  const listId = String(req.params.listId);
  if (!requireUuid(res, listId, LIST_NOT_FOUND)) return;
  const removed = await projectModel.removeList(listId);
  if (!removed) {
    res.status(404).json({ error: LIST_NOT_FOUND });
    return;
  }
  res.status(204).send();
});

export const reorderLists = asyncHandler("Erro ao reordenar listas.", async (req, res) => {
  const projectId = String(req.params.id);
  if (!requireUuid(res, projectId, PROJECT_NOT_FOUND)) return;
  const body = parseBody(res, reorderListsSchema, req.body);
  if (!body) return;
  const board = await projectModel.reorderLists(projectId, body.order);
  if (!board) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }
  res.json(board);
});

export const createCard = asyncHandler("Erro ao criar cartão.", async (req, res) => {
  const listId = String(req.params.listId);
  if (!requireUuid(res, listId, LIST_NOT_FOUND)) return;
  const body = parseBody(res, createCardSchema, req.body);
  if (!body) return;
  const card = await projectModel.createCard(listId, body.title);
  if (!card) {
    res.status(404).json({ error: LIST_NOT_FOUND });
    return;
  }
  res.status(201).json(card);
});

export const updateCard = asyncHandler("Erro ao atualizar cartão.", async (req, res) => {
  const cardId = String(req.params.cardId);
  if (!requireUuid(res, cardId, CARD_NOT_FOUND)) return;
  const body = parseBody(res, updateCardSchema, req.body);
  if (!body) return;
  const card = await projectModel.updateCard(cardId, body);
  if (!card) {
    res.status(404).json({ error: CARD_NOT_FOUND });
    return;
  }
  res.json(card);
});

export const removeCard = asyncHandler("Erro ao remover cartão.", async (req, res) => {
  const cardId = String(req.params.cardId);
  if (!requireUuid(res, cardId, CARD_NOT_FOUND)) return;
  const removed = await projectModel.removeCard(cardId);
  if (!removed) {
    res.status(404).json({ error: CARD_NOT_FOUND });
    return;
  }
  res.status(204).send();
});

export const moveCard = asyncHandler("Erro ao mover cartão.", async (req, res) => {
  const cardId = String(req.params.cardId);
  if (!requireUuid(res, cardId, CARD_NOT_FOUND)) return;
  const body = parseBody(res, moveCardSchema, req.body);
  if (!body) return;
  const board = await projectModel.moveCard(cardId, body.toListId, body.position);
  if (!board) {
    res.status(404).json({ error: CARD_NOT_FOUND });
    return;
  }
  res.json(board);
});

export const createTag = asyncHandler("Erro ao criar tag.", async (req, res) => {
  const projectId = String(req.params.id);
  if (!requireUuid(res, projectId, PROJECT_NOT_FOUND)) return;
  const body = parseBody(res, createTagSchema, req.body);
  if (!body) return;
  const tag = await projectModel.createTag(projectId, body.name, body.color, body.icon);
  if (!tag) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }
  res.status(201).json(tag);
});

export const updateTag = asyncHandler("Erro ao atualizar tag.", async (req, res) => {
  const tagId = String(req.params.tagId);
  if (!requireUuid(res, tagId, TAG_NOT_FOUND)) return;
  const body = parseBody(res, updateTagSchema, req.body);
  if (!body) return;
  const tag = await projectModel.updateTag(tagId, body);
  if (!tag) {
    res.status(404).json({ error: TAG_NOT_FOUND });
    return;
  }
  res.json(tag);
});

export const removeTag = asyncHandler("Erro ao remover tag.", async (req, res) => {
  const tagId = String(req.params.tagId);
  if (!requireUuid(res, tagId, TAG_NOT_FOUND)) return;
  const removed = await projectModel.removeTag(tagId);
  if (!removed) {
    res.status(404).json({ error: TAG_NOT_FOUND });
    return;
  }
  res.status(204).send();
});
