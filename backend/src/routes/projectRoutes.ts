import { Router } from "express";
import {
  getProjects,
  getBoard,
  createProject,
  updateProject,
  removeProject,
  createList,
  updateList,
  removeList,
  reorderLists,
  createCard,
  updateCard,
  removeCard,
  moveCard,
  createTag,
  updateTag,
  removeTag,
} from "../controllers/projectController.js";

const router = Router();

router.get("/", getProjects);
router.post("/", createProject);

router.put("/lists/:listId", updateList);
router.delete("/lists/:listId", removeList);
router.post("/lists/:listId/cards", createCard);

router.put("/cards/:cardId", updateCard);
router.delete("/cards/:cardId", removeCard);
router.post("/cards/:cardId/move", moveCard);

router.put("/tags/:tagId", updateTag);
router.delete("/tags/:tagId", removeTag);

router.post("/:id/lists/reorder", reorderLists);
router.post("/:id/lists", createList);
router.post("/:id/tags", createTag);
router.get("/:id", getBoard);
router.put("/:id", updateProject);
router.delete("/:id", removeProject);

export { router as projectRoutes };
