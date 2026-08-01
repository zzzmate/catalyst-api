const express = require("express");
const router = express.Router();

const heroRouter = require("./hero");
const fanRouter = require("./fanFavourites");
const trendingRouter = require("./trending");
const latestUpdatesRouter = require("./latestUpdates");
const currentlyAiringRouter = require("./currentlyAiring");
const mostPopularRouter = require("./mostPopular");
const topMovieRouter = require("./topMovie");
const topMusicRouter = require("./topMusic");
const topONARouter = require("./topONA");
const topOVARouter = require("./topOVA");
const topSpecialRouter = require("./topSpecial");
const topTVRouter = require("./topTV");
const topTENRouter = require("./topTEN");
const browseRouter = require("./browse");
const infoRouter = require("./info");
const episodesRouter = require("./episodes");

router.use("/hero", heroRouter);
router.use("/fan_favourites", fanRouter);
router.use("/trending", trendingRouter);
router.use("/latest_updates", latestUpdatesRouter);
router.use("/currently_airing", currentlyAiringRouter);
router.use("/most_popular", mostPopularRouter);
router.use("/top_movie", topMovieRouter);
router.use("/top_music", topMusicRouter);
router.use("/top_ona", topONARouter);
router.use("/top_ova", topOVARouter);
router.use("/top_special", topSpecialRouter);
router.use("/top_tv", topTVRouter);
router.use("/top_ten", topTENRouter);
router.use("/browse", browseRouter);
router.use("/info", infoRouter);
router.use("/episodes", episodesRouter);

module.exports = router;
