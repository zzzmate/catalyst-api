const express = require("express");
const router = express.Router();
const featuredRouter = require("./featured");
const newChaptersRouter = require("./newChapters");
const trendingRouter = require("./trending");
const recentRouter = require("./recent");
const searchRouter = require("./search");
const infoRouter = require("./info");
const readRouter = require("./read");
const proxyRouter = require("./proxy");

router.use("/featured", featuredRouter);
router.use("/new_chapters", newChaptersRouter);
router.use("/trending", trendingRouter);
router.use("/recent", recentRouter);
router.use("/search", searchRouter);
router.use("/info", infoRouter);
router.use("/read", readRouter);
router.use("/proxy", proxyRouter);

module.exports = router;
