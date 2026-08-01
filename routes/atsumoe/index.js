const express = require("express");
const router = express.Router();
const hotUpdatesRouter = require("./hotUpdates");
const recentlyUpdatedRouter = require("./recentlyUpdated");
const popularRouter = require("./popular");
const risingRouter = require("./rising");
const hotArrivalsRouter = require("./hotArrivals");
const browseRouter = require("./browse");
const infoRouter = require("./info");
const readRouter = require("./read");
const proxyRouter = require("./proxy");

router.use("/hot_updates", hotUpdatesRouter);
router.use("/recently_updated", recentlyUpdatedRouter);
router.use("/popular", popularRouter);
router.use("/rising", risingRouter);
router.use("/hot_arrivals", hotArrivalsRouter);
router.use("/browse", browseRouter);
router.use("/info", infoRouter);
router.use("/read", readRouter);
router.use("/proxy", proxyRouter);

module.exports = router;
