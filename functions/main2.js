exports.handler = async function(context, event, callback) {
  const assets = Runtime.getAssets();
  const subFunctionAsset = assets['/subFunction2.js'];
  const subFunctionPath = subFunctionAsset.path;
  const subFunction = require(subFunctionPath);
  await subFunction()
  .then(result => {
    console.log(`result: ${result}`);
    callback(null, result);
  })
  .catch(err => {
    console.log(err);
    // callback(err); // これだと、main2自体がエラーで終了する
    callback(null, err.message);  // エラーにはせず、エラーメッセージだけを返す
  });
};
