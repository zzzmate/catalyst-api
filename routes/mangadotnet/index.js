const express = require("express");
const router = express.Router();
const latestUpdatesRouter = require("./latestUpdates");
const recentlyAddedRouter = require("./recentlyAdded");
const mostTrackedRouter = require("./mostTracked");
const topRatedRouter = require("./topRated");
const browseRouter = require("./browse");
const infoRouter = require("./info");
const chaptersRouter = require("./chapters");
const readRouter = require("./read");
const proxyRouter = require("./proxy");

router.use("/latest_updates", latestUpdatesRouter);
router.use("/recently_added", recentlyAddedRouter);
router.use("/most_tracked", mostTrackedRouter);
router.use("/top_rated", topRatedRouter);
router.use("/browse", browseRouter);
router.use("/info", infoRouter);
router.use("/chapters", chaptersRouter);
router.use("/read", readRouter);
router.use("/proxy", proxyRouter);

module.exports = router;
