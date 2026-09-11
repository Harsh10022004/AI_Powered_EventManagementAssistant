const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const eventController = require("../controllers/eventController");
const taskController = require("../controllers/taskController");
const vendorController = require("../controllers/vendorController");
const riskController = require("../controllers/riskController");
const messageController = require("../controllers/messageController");

router.use(requireAuth);

router.get("/", eventController.list);
router.post("/", eventController.create);
router.get("/:id", eventController.getOne);
router.get("/:id/dashboard", eventController.dashboard);
router.delete("/:id", eventController.remove);

router.get("/:eventId/messages", messageController.list);
router.post("/:eventId/messages", messageController.create);

router.post("/:eventId/tasks", taskController.create);
router.patch("/:eventId/tasks/:taskId", taskController.update);
router.delete("/:eventId/tasks/:taskId", taskController.remove);

router.post("/:eventId/vendors", vendorController.create);
router.patch("/:eventId/vendors/:vendorId", vendorController.update);
router.delete("/:eventId/vendors/:vendorId", vendorController.remove);

router.patch("/:eventId/risks/:riskId", riskController.update);

module.exports = router;
