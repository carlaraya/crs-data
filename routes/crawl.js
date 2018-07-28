var express = require('express');
var router = express.Router();
var cheerio = require('cheerio');
var axios = require('axios');
var format = require('string-format');
var RawClass = require('../models/raw-class');

const CRS_URL = 'https://crs.upd.edu.ph/schedule/120{}{}/{}';

/* GET crawlers listing. */
router.get('/', function(req, res, next) {
  res.render('crawl/index');
});

function count(arr, elem) {
  var ct = 0;
  for(let i=0; i<arr.length; i++)
      if (arr[i]===elem)
          ct++;
  return ct;
}

function range(start, end) {
  return [...Array(end-start).keys()].map(v => start+v);
}

function zip(a, b) {
  return a.map((a, i) => [a, b[i]]);
}

function crsLinksArr(year, sem) {
  if (sem === 'all') {
    var sem = [1, 2, 4];
  } else {
    var sem = [sem];
  }
  var arrOfArrsOfLinks = sem.map(function(s) {
    return range(0, 26).map(function (i) { 
      var letter = String.fromCharCode(97 + i);
      return format(CRS_URL, year, s, letter);
    })
  });
  var arrOfLinks = arrOfArrsOfLinks.reduce((acc, val) => acc.concat(val), []);
  return arrOfLinks;
}

function crsPromisesArr(year, sem) {
  return crsLinksArr(year, sem).map(function(crsLink) {
    return axios.get(crsLink)
      .then(function(res) {
        var rows = getRows(res.data);
        var rowObjs = rows.map((row) => { return {html: row} });
        return RawClass.insertMany(rowObjs)
          .then(function(docs) {
            return format('{} out of {} were stored.', docs.length, rowObjs.length);
          })
          .catch(function(e) {
            return e;
          });
      })
      .catch(function(e) {
        return e.stack;
      });
  })
}

function getRows(htmlPage) {
  const $ = cheerio.load(htmlPage);
  return $("tr td[rowspan='1']").parent().map(function() {
    return $(this).html();
  }).get();
}


router.get('/regular_classes/:year/:sem', function(req, res, next) {
  var linksArr = crsLinksArr(req.params.year, req.params.sem);
  var promisesArr = crsPromisesArr(req.params.year, req.params.sem);

  Promise.all(promisesArr)
    .then(function(resultsArr) {
      res.send(zip(linksArr, resultsArr));
    })
    .catch(function(e) {
      res.send(e.stack);
    });
});

router.get('/delete_db', function(req, res, next) {
  RawClass.deleteMany({}, function(e) {
    if (e) {
      res.send(e);
    } else {
      res.send('Success.');
    }
  });
});

module.exports = router;
