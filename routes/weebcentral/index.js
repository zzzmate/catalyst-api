const express = require("express");
const router = express.Router();
const hotUpdatesRouter = require("./hotUpdates");
const latestUpdatesRouter = require("./latestUpdates");
const recommendationsRouter = require("./recommendations");
const browseRouter = require("./browse");
const infoRouter = require("./info");
const chaptersRouter = require("./chapters");
const readRouter = require("./read");
const proxyRouter = require("./proxy");

router.use("/hot_updates", hotUpdatesRouter);
router.use("/latest_updates", latestUpdatesRouter);
router.use("/recommendations", recommendationsRouter);
router.use("/browse", browseRouter);
router.use("/info", infoRouter);
router.use("/chapters", chaptersRouter);
router.use("/read", readRouter);
router.use("/proxy", proxyRouter);

module.exports = router;
