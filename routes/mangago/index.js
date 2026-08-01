const express = require("express");
const router = express.Router();
const featuredRouter = require("./featured");
const popularRouter = require("./popular");
const newChaptersRouter = require("./newChapters");
const topGenresRouter = require("./topGenres");
const browseRouter = require("./browse");
const infoRouter = require("./info");
const readRouter = require("./read");
const proxyRouter = require("./proxy");

router.use("/featured", featuredRouter);
router.use("/popular", popularRouter);
router.use("/new_chapters", newChaptersRouter);
router.use("/top_genres", topGenresRouter);
router.use("/browse", browseRouter);
router.use("/info", infoRouter);
router.use("/read", readRouter);
router.use("/proxy", proxyRouter);

module.exports = router;
