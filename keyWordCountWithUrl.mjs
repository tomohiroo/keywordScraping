const client = require("cheerio-httpcli");
const fs = require("fs");
const jqueryCsv = require("jquery-csv");

const primaryPositiveKeywords = ["装置", "設計"];
const secodoryPositiveKeywords = [
  "製造",
  "製作",
  "機",
  "メーカー",
  "計",
  "システム"
];
const negativeKeywords = [
  "部品製造",
  "部品製造",
  "部品の製造",
  "部品の加工",
  "部品の販売",
  "パーツ製造",
  "パーツ加工",
  "パーツの製造",
  "パーツの加工",
  "パーツの販売",
  "自動車部品",
  "商社",
  "卸",
  "貿易",
  "切削"
];
const keywords = [
  ...primaryPositiveKeywords,
  ...secodoryPositiveKeywords,
  ...negativeKeywords
];

const columns = ["iid", "URL", ...keywords, "精査対象"];

function sleep(time) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

const keywordFolder = "./keyword/";
let keywordArray = [];
fs.readdirSync(keywordFolder).forEach(file => {
  if (file.indexOf("csv") > -1) {
    let kw = file.slice(0, -4);
    keywordArray.push(kw);
  }
});

const main = (maxcount, kwIndex, i) => {
  // iはkeywordディレクトリのインデックス
  let urlArray = makeUrlArray(keywordArray[kwIndex]);
  let kw2 = keywordArray[kwIndex];
  sleep(0)
    .then(() => {
      return scraping(urlArray.length, kwIndex, i, kw2);
    })
    .then(() => {
      if (kwIndex + 1 < keywordArray.length) {
        main(keywordArray.length, kwIndex + 1, 0);
      } else {
        console.log("全てのスクレイピングが終了しました。");
      }
    });
};

const makeUrlArray = fileName => {
  let urlArray = [];
  let kwCsv = fs.readFileSync(`keyword/${fileName}.csv`, {
    encoding: "utf-8"
  });

  let kwArray = jqueryCsv.toArrays(kwCsv);
  for (i = 0, d = kwArray.length; i < d; i++) {
    urlArray.push(kwArray[i][1]);
  }
  return urlArray;
};

const makeIdArray = kw2 => {
  let idArray = [];
  let kwCsv = fs.readFileSync(`keyword/${kw2}.csv`, {
    encoding: "utf-8"
  });

  let kwArray = jqueryCsv.toArrays(kwCsv);
  for (i = 0, d = kwArray.length; i < d; i++) {
    idArray.push(kwArray[i][0]);
  }
  return idArray;
};

const counter = (str, seq) => {
  return str.split(seq).length - 1;
};

const scraping = (maxcount, kwIndex, i, kw2) => {
  return new Promise((resolve, reject) => {
    let urlArray = makeUrlArray(kw2);
    let idArray = makeIdArray(kw2);
    if (i < maxcount) {
      (url => {
        try {
          const firstPage = client.fetchSync(url);
          let body = firstPage.body;
          if (body) {
            const primaryPositiveKeywordCount = primaryPositiveKeywords.map(
              kw => counter(body, kw)
            );
            const secodoryPositiveKeywordCount = secodoryPositiveKeywords.map(
              kw => counter(body, kw)
            );
            const negativeKeywordCount = negativeKeywords.map(kw =>
              counter(body, kw)
            );
            const score = [
              ...primaryPositiveKeywordCount.map(v => v * 10),
              ...secodoryPositiveKeywordCount,
              ...negativeKeywordCount.map(v => v * -5)
            ].reduce((a, b) => a + b);
            const scrapingResults = [
              idArray[i],
              urlArray[i],
              ...primaryPositiveKeywordCount,
              ...secodoryPositiveKeywordCount,
              ...negativeKeywordCount,
              score
            ];
            writeCsv(scrapingResults, kw2, columns);
          }
        } catch (e) {
          console.log(`ERROR: ${e.message}`);
          console.log(`id:${idArray[i]},\nurl:${urlArray[i]}`);
          writeCsv([idArray[i], urlArray[i]], kw2, columns);
        }
      })(result);
      console.log(`${i} / ${urlArray.length}`);
      main(maxcount, kwIndex, i + 1);
    } else {
      console.log(`${kw2}のスクレイピングが終了しました。`);
      resolve();
    }
  });
};

const checkFile = path => {
  let isExist = false;
  try {
    fs.statSync(path);
    isExist = true;
  } catch (error) {
    isExist = false;
  }
  return isExist;
};

const writeCsv = (data, kw2, column) => {
  const dirname = "results";
  try {
    fs.statSync(`./${dirname}`);
    // データの二重登録を防ぐために、dirnameが存在してたらそのディレクトリを削除して作り直す処理書くべき？
  } catch (error) {
    fs.mkdir(dirname, err => {
      console.log(err);
    });
  }
  if (checkFile(`./${dirname}/${kw2}.csv`)) {
    fs.appendFileSync(
      `./${dirname}/${kw2}.csv`,
      [
        data.map(v => {
          if (typeof v == "number") {
            return v;
          } else {
            const data = v
              .split("\n")
              .join(",")
              .split("\r")
              .join(",");
            return data.match(",") ? `"${data}"` : data;
          }
        }) + "\n"
      ],
      err => {
        if (err) throw err;
      }
    );
  } else {
    fs.writeFileSync(`./${dirname}/${kw2}.csv`);
    // excelで開く際の文字化け防止でBom付きutf8に変換
    writeBom(`./${dirname}/${kw2}.csv`);
    console.log(`./${dirname}/${kw2}.csv is crated`);
    fs.appendFileSync(`./${dirname}/${kw2}.csv`, [column + "\n"], err => {
      if (err) throw err;
    });
  }
};

const writeBom = path => {
  fs.writeFile(path, "\uFEFF", err => {
    if (err) {
      throw err;
    }
  });
};

main(keywordArray.length, 0, 0);
