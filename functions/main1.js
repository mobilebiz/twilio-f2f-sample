const rp = require('request-promise');
exports.handler = async function(context, event, callback) {
  await rp(`https://${context.DOMAIN_NAME}/subFunction1`)
  .then(res => {
    console.log(`res: ${res}`);
    callback(null, 'main1 done.');
  })
  .catch(err => {
    // callback(err); // これだと、main2自体がエラーで終了する
    callback(null, err.message);  // エラーにはせず、エラーメッセージだけを返す
  });
};
